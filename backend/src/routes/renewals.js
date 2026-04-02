import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { query } from '../db/pool.js';
import { ensureSequences } from '../db/sequences.js';
import { decorateRenewal, parseRenewalWorkbook } from '../lib/renewals.js';
import { requireDataManage, requireRenewalRmAccess } from '../middleware/auth.js';
import { applyAssignedRmScope, scopedRmExpression } from '../lib/access.js';
import { recordAuditLog } from '../lib/audit.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const DAYS_TO_RENEWAL_SQL = `
  CASE
    WHEN r.policy_valid_till IS NULL THEN NULL
    ELSE (r.policy_valid_till::date - CURRENT_DATE)
  END
`;

const BUCKET_SQL = `
  CASE
    WHEN r.status = 'Renewed' THEN 'renewed'
    WHEN r.policy_valid_till IS NULL THEN 'unknown'
    WHEN r.policy_valid_till < CURRENT_DATE - 30 THEN 'expired_30_plus'
    WHEN r.policy_valid_till < CURRENT_DATE - 15 THEN 'expired_16_30'
    WHEN r.policy_valid_till < CURRENT_DATE THEN 'expired_1_15'
    WHEN r.policy_valid_till = CURRENT_DATE THEN 'due_today'
    WHEN r.policy_valid_till <= CURRENT_DATE + 7 THEN 'due_1_7'
    WHEN r.policy_valid_till <= CURRENT_DATE + 15 THEN 'due_8_15'
    WHEN r.policy_valid_till <= CURRENT_DATE + 30 THEN 'due_16_30'
    ELSE 'due_31_plus'
  END
`;

const CUSTOMER_RESPONSE_SQL = `COALESCE(NULLIF(r.customer_response, ''), 'No Response')`;
const IS_DUE_SOON_SQL = `
  CASE
    WHEN r.status <> 'Renewed'
      AND r.policy_valid_till IS NOT NULL
      AND r.policy_valid_till >= CURRENT_DATE
      AND r.policy_valid_till <= CURRENT_DATE + 30
    THEN TRUE
    ELSE FALSE
  END
`;
const IS_EXPIRED_SQL = `
  CASE
    WHEN r.status <> 'Renewed'
      AND r.policy_valid_till IS NOT NULL
      AND r.policy_valid_till < CURRENT_DATE
    THEN TRUE
    ELSE FALSE
  END
`;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

router.get('/', requireRenewalRmAccess, async (req, res) => {
  const {
    renewal_dump_id,
    rm_name,
    status,
    insurer,
    customer_response,
    search,
    bucket,
    mode,
    page = 1,
    limit = DEFAULT_LIMIT,
  } = req.query;

  const pageNum = parsePositiveInt(page, 1);
  const limitNum = Math.min(parsePositiveInt(limit, DEFAULT_LIMIT), MAX_LIMIT);
  const offset = (pageNum - 1) * limitNum;
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
    where.push(`${CUSTOMER_RESPONSE_SQL} = $${params.length}`);
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
  if (bucket) {
    params.push(bucket);
    where.push(`${BUCKET_SQL} = $${params.length}`);
  }
  if (mode === 'dueSoon') {
    where.push(`r.status <> 'Renewed'`);
    where.push(`r.policy_valid_till IS NOT NULL`);
    where.push(`r.policy_valid_till >= CURRENT_DATE`);
    where.push(`r.policy_valid_till <= CURRENT_DATE + 30`);
  }
  if (mode === 'expired') {
    where.push(`r.status <> 'Renewed'`);
    where.push(`r.policy_valid_till IS NOT NULL`);
    where.push(`r.policy_valid_till < CURRENT_DATE`);
  }
  applyAssignedRmScope(req.user, params, where, scopedRmExpression('r'));

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dataParams = [...params, limitNum, offset];

  const [result, countRes, rmRes, insurerRes] = await Promise.all([
    query(`
      SELECT
        r.*,
        d.company AS dump_company,
        ${CUSTOMER_RESPONSE_SQL} AS customer_response,
        ${DAYS_TO_RENEWAL_SQL} AS days_to_renewal,
        ${BUCKET_SQL} AS bucket,
        ${IS_DUE_SOON_SQL} AS is_due_soon,
        ${IS_EXPIRED_SQL} AS is_expired
      FROM renewals r
      JOIN renewal_dumps d ON d.id = r.renewal_dump_id
      ${whereSql}
      ORDER BY r.policy_valid_till ASC NULLS LAST, r.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, dataParams),
    query(`
      SELECT COUNT(*)::int AS total
      FROM renewals r
      ${whereSql}
    `, params),
    query(`
      SELECT DISTINCT r.rm_name
      FROM renewals r
      ${whereSql}
        AND NULLIF(TRIM(r.rm_name), '') IS NOT NULL
      ORDER BY r.rm_name ASC
    `, params),
    query(`
      SELECT DISTINCT r.insurer
      FROM renewals r
      ${whereSql}
        AND NULLIF(TRIM(r.insurer), '') IS NOT NULL
      ORDER BY r.insurer ASC
    `, params),
  ]);

  const total = countRes.rows[0]?.total || 0;

  res.json({
    data: result.rows.map(decorateRenewal),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
    meta: {
      rms: rmRes.rows.map((row) => row.rm_name),
      insurers: insurerRes.rows.map((row) => row.insurer),
    },
  });
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

  const before = await query(`
    SELECT *
    FROM renewals
    WHERE id = $1
      AND deleted_at IS NULL
  `, [req.params.id]);
  if (!before.rows.length) return res.status(404).json({ error: 'Renewal record not found' });

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
  const updated = decorateRenewal(result.rows[0]);
  const changed = Object.keys({
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
  }).filter((key) => req.body[key] !== undefined);
  await recordAuditLog({
    req,
    action: 'renewal.update',
    entityType: 'renewal',
    entityId: updated.id,
    entityLabel: updated.policy_number || updated.vehicle_number || updated.id,
    details: {
      summary: changed.length ? `Updated ${changed.join(', ')}` : `Updated renewal ${updated.id}`,
      changed_fields: changed,
      renewal_dump_id: updated.renewal_dump_id,
      previous_status: before.rows[0].status,
      next_status: updated.status,
    },
  });
  res.json({ data: updated });
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

  await recordAuditLog({
    req,
    action: 'renewal.import',
    entityType: 'renewal_dump',
    entityId: renewal_dump_id,
    entityLabel: renewal_dump_id,
    details: {
      summary: `Imported ${inserted} renewal records`,
      count: inserted,
      filename: req.file.originalname,
      sheets_used: sheetsUsed,
    },
  });
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
  await recordAuditLog({
    req,
    action: 'renewal.delete',
    entityType: 'renewal',
    entityId: result.rows[0].id,
    entityLabel: result.rows[0].policy_number || result.rows[0].vehicle_number || result.rows[0].id,
    details: {
      summary: `Deleted renewal record ${result.rows[0].id}`,
    },
  });
  res.json({ message: 'Renewal record deleted', data: result.rows[0] });
});

export default router;
