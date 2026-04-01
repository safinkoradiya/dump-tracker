import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { query } from '../db/pool.js';
import { nextPolicyId, ensureSequences } from '../db/sequences.js';
import { requireDataManage, requireDiscrepancyRmAccess } from "../middleware/auth.js";
import { applyAssignedRmScope, scopedRmExpression } from '../lib/access.js';
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Days pending helper (computed in JS matching frontend logic)
function daysPending(recvDate, rmResolved, companyResolved) {
  if (rmResolved && companyResolved) return null;
  if (!recvDate) return null;
  const start = new Date(recvDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86400000);
  return diff >= 0 ? diff : 0;
}

function getBucket(days) {
  if (days === null) return 'resolved';
  if (days < 3) return 'hot';
  if (days <= 15) return 'warm';
  return 'cold';
}

// GET /api/policies — list with filters + pagination
router.get('/', requireDiscrepancyRmAccess, async (req, res) => {
  const {
    dump_id, rm_name, status, company,
    bucket, pending_side,
    page = 1, limit = 100,
    search
  } = req.query;

  const params = [];
  const where = [];

  if (dump_id)      { params.push(dump_id);      where.push(`p.dump_id = $${params.length}`); }
  if (rm_name)      { params.push(rm_name);       where.push(`p.rm_name = $${params.length}`); }
  if (pending_side) { params.push(pending_side);  where.push(`p.pending_side ILIKE $${params.length}`); }
  if (company)      { params.push(`%${company}%`); where.push(`d.company ILIKE $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(p.policy_no ILIKE $${params.length} OR p.rm_name ILIKE $${params.length} OR p.imd_name ILIKE $${params.length})`);
  }
  if (status === 'Resolved') where.push(`(p.rm_resolved AND p.company_resolved)`);
  if (status === 'Pending')  where.push(`NOT (p.rm_resolved AND p.company_resolved)`);
  where.push(`p.deleted_at IS NULL`);
  applyAssignedRmScope(req.user, params, where, scopedRmExpression('p'));

  const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const offset = (Number(page) - 1) * Number(limit);
  params.push(Number(limit), offset);

  const sql = `
    SELECT p.*, d.company,
      p.rm_resolved AND p.company_resolved AS is_resolved
    FROM policies p
    JOIN dumps d ON d.id = p.dump_id
    ${whereSQL}
    ORDER BY p.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM policies p
    JOIN dumps d ON d.id = p.dump_id
    ${whereSQL}
  `;

  const [rows, countRes] = await Promise.all([
    query(sql, params),
    query(countSql, params.slice(0, -2))
  ]);

  // Attach computed fields
  const data = rows.rows.map(p => ({
    ...p,
    days_pending: daysPending(p.recv_date, p.rm_resolved, p.company_resolved),
    bucket: getBucket(daysPending(p.recv_date, p.rm_resolved, p.company_resolved)),
    status: p.rm_resolved && p.company_resolved ? 'Resolved' : 'Pending',
  }));

  // Bucket filter applied after query (needs computed days_pending)
  const filtered = bucket ? data.filter(p => p.bucket === bucket) : data;

  res.json({
    data: filtered,
    total: countRes.rows[0].total,
    page: Number(page),
    limit: Number(limit),
  });
});

// GET /api/policies/:id
router.get('/:id', requireDiscrepancyRmAccess, async (req, res) => {
  const params = [req.params.id];
  const where = [`p.id = $1`, `p.deleted_at IS NULL`];
  applyAssignedRmScope(req.user, params, where, scopedRmExpression('p'));
  const result = await query(
    `SELECT p.*, d.company
     FROM policies p
     JOIN dumps d ON d.id = p.dump_id
     WHERE ${where.join(' AND ')}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Policy not found' });
  const p = result.rows[0];
  res.json({
    data: {
      ...p,
      days_pending: daysPending(p.recv_date, p.rm_resolved, p.company_resolved),
      bucket: getBucket(daysPending(p.recv_date, p.rm_resolved, p.company_resolved)),
      status: p.rm_resolved && p.company_resolved ? 'Resolved' : 'Pending',
    }
  });
});

// POST /api/policies — add single policy
router.post('/', requireDataManage, async (req, res) => {
  await ensureSequences();
  const { policy_no, dump_id, recv_date, rm_name, imd_name, given_date,
          rm_response, rm_resolved, company_resolved, remarks, pending_side, extra } = req.body;

  if (!policy_no) return res.status(400).json({ error: 'policy_no is required' });
  if (!dump_id)   return res.status(400).json({ error: 'dump_id is required' });

  const dumpCheck = await query('SELECT id FROM dumps WHERE id=$1', [dump_id]);
  if (!dumpCheck.rows.length) return res.status(400).json({ error: 'dump_id does not exist' });

  const id = await nextPolicyId();
  const result = await query(`
    INSERT INTO policies
      (id, policy_no, dump_id, recv_date, rm_name, imd_name, given_date,
       rm_response, rm_resolved, company_resolved, remarks, pending_side, extra)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *
  `, [id, policy_no, dump_id, recv_date || null, rm_name || '', imd_name || '',
      given_date || null, rm_response || '', rm_resolved || false,
      company_resolved || false, remarks || '', pending_side || '',
      JSON.stringify(extra || {})]);

  res.status(201).json({ data: result.rows[0] });
});

// PATCH /api/policies/:id — update any field
router.patch('/:id', requireDataManage, async (req, res) => {
  const { rm_name, imd_name, given_date, recv_date, rm_response,
          rm_resolved, company_resolved, remarks, pending_side } = req.body;

  const result = await query(`
    UPDATE policies SET
      rm_name          = COALESCE($1,  rm_name),
      imd_name         = COALESCE($2,  imd_name),
      given_date       = COALESCE($3,  given_date),
      recv_date        = COALESCE($4,  recv_date),
      rm_response      = COALESCE($5,  rm_response),
      rm_resolved      = COALESCE($6,  rm_resolved),
      company_resolved = COALESCE($7,  company_resolved),
      remarks          = COALESCE($8,  remarks),
      pending_side     = COALESCE($9,  pending_side)
    WHERE id = $10
      AND deleted_at IS NULL
    RETURNING *
  `, [rm_name, imd_name, given_date || null, recv_date || null,
      rm_response, rm_resolved, company_resolved, remarks, pending_side, req.params.id]);

  if (!result.rows.length) return res.status(404).json({ error: 'Policy not found' });
  const p = result.rows[0];
  res.json({
    data: {
      ...p,
      days_pending: daysPending(p.recv_date, p.rm_resolved, p.company_resolved),
      status: p.rm_resolved && p.company_resolved ? 'Resolved' : 'Pending',
    }
  });
});

// POST /api/policies/import — Excel/CSV bulk import linked to a dump
router.post("/import", requireDataManage, upload.single('file'), async (req, res) => {
  await ensureSequences();
  const { dump_id } = req.body;
  if (!dump_id)    return res.status(400).json({ error: 'dump_id is required' });
  if (!req.file)   return res.status(400).json({ error: 'file is required' });

  const dumpCheck = await query('SELECT id, upload_date FROM dumps WHERE id=$1', [dump_id]);
  if (!dumpCheck.rows.length) return res.status(400).json({ error: 'dump_id does not exist' });
  const uploadDate = dumpCheck.rows[0].upload_date;

  const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const get = (row, ...keys) => {
    for (const k of keys) if (row[k] !== undefined && row[k] !== '') return String(row[k]).trim();
    return '';
  };
  const getDate = (row, ...keys) => {
    for (const k of keys) {
      if (row[k]) {
        const v = row[k];
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        const p = new Date(v);
        if (!isNaN(p)) return p.toISOString().slice(0, 10);
      }
    }
    return null;
  };

  const mapped = rows.map(row => ({
    policyNo:  get(row, 'PolicyNo','Policy Number','policy_number','PolicyNumber','Policy No','InsurerQuoteNo'),
    recvDate:  getDate(row, 'PolicyIssueDate','Dump Received Date','recv_date','Received Date','PolicyStartDate'),
    rmName:    get(row, 'LOGINID','RM Name','rm_name','RM','RMName','Login ID'),
    imdName:   get(row, 'INTERMEDIARYNAME','IMD Name','imd_name','IMD','IMDName','Intermediary Name'),
    rmResponse: get(row, 'QCRejectionRemarks','RM Response','rm_response','Response','Rejection Remarks'),
    remarks:   get(row, 'Ageing','PolicyStatus','Remarks','remarks','Notes','Policy Status'),
    extra: {
      branch:       get(row, 'BRANCHNAME','BranchName','Branch Name'),
      product:      get(row, 'Product_Name','ProductName','Product Name'),
      regNo:        get(row, 'RegistrationNo','Reg No','Registration No'),
      premium:      get(row, 'FinalPremium','Final Premium','NetPremium','Net Premium'),
      customerName: [get(row,'CustomerFirstName','First Name'), get(row,'CustomerLastName','Last Name')].filter(Boolean).join(' '),
      policyStatus: get(row, 'PolicyStatus','Policy Status'),
      ageing:       get(row, 'Ageing','No of days'),
    }
  })).filter(r => r.policyNo);

  if (!mapped.length) return res.status(400).json({ error: 'No valid policies found in file. Check that PolicyNo column exists.' });

  // Bulk insert
  let inserted = 0;
  for (const r of mapped) {
    const id = await nextPolicyId();
    const insertRes = await query(`
      INSERT INTO policies
        (id, policy_no, dump_id, recv_date, rm_name, imd_name, rm_response, remarks, pending_side, extra)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT DO NOTHING
    `, [id, r.policyNo, dump_id, r.recvDate || uploadDate, r.rmName, r.imdName,
        r.rmResponse, r.remarks, '', JSON.stringify(r.extra)]);
    inserted += insertRes.rowCount || 0;
  }

  res.status(201).json({ message: `Imported ${inserted} policies into ${dump_id}`, count: inserted });
});

router.delete('/:id', requireDataManage, async (req, res) => {
  const result = await query(`
    UPDATE policies
    SET deleted_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id, policy_no, dump_id
  `, [req.params.id]);

  if (!result.rows.length) return res.status(404).json({ error: 'Policy not found' });
  res.json({ message: 'Policy deleted', data: result.rows[0] });
});

export default router;
