import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { query } from '../db/pool.js';
import { ensureSequences } from '../db/sequences.js';
import { decorateRenewal, parseRenewalWorkbook } from '../lib/renewals.js';
import { requireDataManage, requireRenewalRmAccess } from '../middleware/auth.js';
import { applyAssignedRmScope, scopedRmExpression } from '../lib/access.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.get('/', requireRenewalRmAccess, async (req, res) => {
  const {
    renewal_dump_id,
    rm_name,
    status,
    insurer,
    customer_response,
    search,
    limit = 1000,
  } = req.query;

  const params = [];
  const where = ['r.deleted_at IS NULL'];

  if (renewal_dump_id) {
    params.push(renewal_dump_id);
    where.push(`r.renewal_dump_id = $${params.length}`);
  }
  if (rm_name) {
    params.push(rm_name);
    where.push(`r.rm_name = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`r.status = $${params.length}`);
  }
  if (insurer) {
    params.push(`%${insurer}%`);
    where.push(`r.insurer ILIKE $${params.length}`);
  }
  if (customer_response) {
    params.push(customer_response);
    where.push(`r.customer_response = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    where.push(`(
      r.policy_number ILIKE $${idx}
      OR r.original_policy_number ILIKE $${idx}
      OR r.vehicle_number ILIKE $${idx}
      OR r.policy_holder_name ILIKE $${idx}
      OR r.rm_name ILIKE $${idx}
    )`);
  }
  applyAssignedRmScope(req.user, params, where, scopedRmExpression('r'));

  params.push(Number(limit));
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await query(`
    SELECT r.*, d.company AS dump_company
    FROM renewals r
    JOIN renewal_dumps d ON d.id = r.renewal_dump_id
    ${whereSql}
    ORDER BY r.policy_valid_till ASC NULLS LAST, r.created_at DESC
    LIMIT $${params.length}
  `, params);

  res.json({ data: result.rows.map(decorateRenewal) });
});

router.get('/:id', requireRenewalRmAccess, async (req, res) => {
  const params = [req.params.id];
  const where = [`r.id = $1`, `r.deleted_at IS NULL`];
  applyAssignedRmScope(req.user, params, where, scopedRmExpression('r'));
  const result = await query(`
    SELECT r.*, d.company AS dump_company
    FROM renewals r
    JOIN renewal_dumps d ON d.id = r.renewal_dump_id
    WHERE ${where.join(' AND ')}
  `, params);

  if (!result.rows.length) return res.status(404).json({ error: 'Renewal record not found' });
  res.json({ data: decorateRenewal(result.rows[0]) });
});

router.patch('/:id', requireDataManage, async (req, res) => {
  const {
    rm_name,
    status,
    customer_response,
    pending_with,
    next_follow_up_date,
    quoted_premium,
    renewed_premium,
    renewed_insurer,
    renewed_on,
    remarks,
  } = req.body;

  const result = await query(`
    UPDATE renewals
    SET
      rm_name = COALESCE($1, rm_name),
      status = COALESCE($2, status),
      customer_response = COALESCE($3, customer_response),
      pending_with = COALESCE($4, pending_with),
      next_follow_up_date = COALESCE($5, next_follow_up_date),
      quoted_premium = COALESCE($6, quoted_premium),
      renewed_premium = COALESCE($7, renewed_premium),
      renewed_insurer = COALESCE($8, renewed_insurer),
      renewed_on = COALESCE($9, renewed_on),
      remarks = COALESCE($10, remarks)
    WHERE id = $11
      AND deleted_at IS NULL
    RETURNING *
  `, [
    rm_name,
    status,
    customer_response,
    pending_with,
    next_follow_up_date || null,
    quoted_premium,
    renewed_premium,
    renewed_insurer,
    renewed_on || null,
    remarks,
    req.params.id,
  ]);

  if (!result.rows.length) return res.status(404).json({ error: 'Renewal record not found' });
  res.json({ data: decorateRenewal(result.rows[0]) });
});

router.post('/import', requireDataManage, upload.single('file'), async (req, res) => {
  await ensureSequences();
  const { renewal_dump_id } = req.body;
  if (!renewal_dump_id) return res.status(400).json({ error: 'renewal_dump_id is required' });
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  const dumpRes = await query(`
    SELECT id, upload_date
    FROM renewal_dumps
    WHERE id = $1
  `, [renewal_dump_id]);
  if (!dumpRes.rows.length) return res.status(400).json({ error: 'renewal_dump_id does not exist' });

  const { rows, sheetsUsed } = parseRenewalWorkbook(req.file.buffer);
  let inserted = 0;

  const batchSize = 200;
  const columns = [
    'id', 'renewal_dump_id', 'dedupe_key', 'sheet_name', 'policy_number', 'original_policy_number',
    'policy_holder_name', 'policy_holder_phone', 'policy_holder_email', 'insurer', 'broker_name',
    'broker_code', 'rm_name', 'source_rm', 'latest_rm', 'source_partner', 'source_partner_code',
    'source_partner_type', 'vehicle_number', 'vehicle_make', 'vehicle_model', 'vehicle_variant',
    'year_of_manufacture', 'policy_type', 'vehicle_class', 'vehicle_subclass', 'subclass_name',
    'vehicle_cc', 'vehicle_gvw', 'pivot_points', 'seating_capacity', 'fuel_type', 'rto_code',
    'inwarding_date', 'policy_issue_date', 'policy_valid_from', 'policy_valid_till', 'od_end_date',
    'tp_end_date', 'net_premium', 'total_premium_amount', 'status', 'customer_response', 'pending_with',
    'next_follow_up_date', 'quoted_premium', 'renewed_premium', 'renewed_insurer', 'renewed_on',
    'remarks', 'raw_data',
  ];

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const values = [];
    const placeholders = batch.map((row, rowIndex) => {
      const record = [
        randomUUID(),
        renewal_dump_id,
        row.dedupe_key,
        row.sheet_name,
        row.policy_number,
        row.original_policy_number,
        row.policy_holder_name,
        row.policy_holder_phone,
        row.policy_holder_email,
        row.insurer,
        row.broker_name,
        row.broker_code,
        row.rm_name,
        row.source_rm,
        row.latest_rm,
        row.source_partner,
        row.source_partner_code,
        row.source_partner_type,
        row.vehicle_number,
        row.vehicle_make,
        row.vehicle_model,
        row.vehicle_variant,
        row.year_of_manufacture,
        row.policy_type,
        row.vehicle_class,
        row.vehicle_subclass,
        row.subclass_name,
        row.vehicle_cc,
        row.vehicle_gvw,
        row.pivot_points,
        row.seating_capacity,
        row.fuel_type,
        row.rto_code,
        row.inwarding_date || dumpRes.rows[0].upload_date,
        row.policy_issue_date,
        row.policy_valid_from,
        row.policy_valid_till,
        row.od_end_date,
        row.tp_end_date,
        row.net_premium,
        row.total_premium_amount,
        row.status,
        row.customer_response,
        row.pending_with,
        row.next_follow_up_date,
        row.quoted_premium,
        row.renewed_premium,
        row.renewed_insurer,
        row.renewed_on,
        row.remarks,
        JSON.stringify(row.raw_data || {}),
      ];
      values.push(...record);
      const start = rowIndex * columns.length;
      return `(${record.map((_, valueIndex) => `$${start + valueIndex + 1}`).join(',')})`;
    });

    const insertRes = await query(`
      INSERT INTO renewals (${columns.join(', ')})
      VALUES ${placeholders.join(',')}
      ON CONFLICT (renewal_dump_id, dedupe_key) WHERE deleted_at IS NULL DO NOTHING
    `, values);

    inserted += insertRes.rowCount || 0;
  }

  res.status(201).json({
    message: `Imported ${inserted} renewal records into ${renewal_dump_id}`,
    count: inserted,
    sheets_used: sheetsUsed,
  });
});

router.delete('/:id', requireDataManage, async (req, res) => {
  const result = await query(`
    UPDATE renewals
    SET deleted_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id, policy_number, vehicle_number
  `, [req.params.id]);

  if (!result.rows.length) return res.status(404).json({ error: 'Renewal record not found' });
  res.json({ message: 'Renewal record deleted', data: result.rows[0] });
});

export default router;
