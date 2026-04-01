import { Router } from 'express';
import { query } from '../db/pool.js';
import { nextRenewalDumpId, ensureSequences } from '../db/sequences.js';
import { decorateRenewal } from '../lib/renewals.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

function summarizeDump(dump, renewals) {
  const active = renewals.filter((row) => !row.deleted_at);
  const deleted = renewals.filter((row) => row.deleted_at);
  const decorated = active.map(decorateRenewal);
  const renewed = decorated.filter((row) => row.status === 'Renewed').length;
  const dueSoon = decorated.filter((row) => row.is_due_soon).length;
  const expired = decorated.filter((row) => row.is_expired).length;

  let status = 'Pending';
  if (decorated.length && renewed === decorated.length) status = 'Completed';
  else if (renewed > 0) status = 'In Progress';
  else if (dueSoon || expired) status = 'Pending';

  return {
    ...dump,
    total_renewals: decorated.length,
    renewed_count: renewed,
    due_soon_count: dueSoon,
    expired_count: expired,
    deleted_renewals: deleted.length,
    status,
  };
}

router.get('/', async (req, res) => {
  const dumpsRes = await query(`SELECT * FROM renewal_dumps ORDER BY created_at DESC`);
  const renewalsRes = await query(`
    SELECT renewal_dump_id, status, policy_valid_till, deleted_at
    FROM renewals
  `);

  const grouped = renewalsRes.rows.reduce((acc, row) => {
    acc[row.renewal_dump_id] ||= [];
    acc[row.renewal_dump_id].push(row);
    return acc;
  }, {});

  const rows = dumpsRes.rows.map((dump) => summarizeDump(dump, grouped[dump.id] || []));
  res.json({ data: rows });
});

router.get('/:id', async (req, res) => {
  const dumpRes = await query(`SELECT * FROM renewal_dumps WHERE id = $1`, [req.params.id]);
  if (!dumpRes.rows.length) return res.status(404).json({ error: 'Renewal dump not found' });

  const renewalsRes = await query(`
    SELECT renewal_dump_id, status, policy_valid_till, deleted_at
    FROM renewals
    WHERE renewal_dump_id = $1
  `, [req.params.id]);

  res.json({ data: summarizeDump(dumpRes.rows[0], renewalsRes.rows) });
});

router.post('/', requireAdmin, async (req, res) => {
  await ensureSequences();
  const { company, upload_date, remarks } = req.body;
  if (!company) return res.status(400).json({ error: 'company is required' });
  if (!upload_date) return res.status(400).json({ error: 'upload_date is required' });

  const id = await nextRenewalDumpId();
  const result = await query(`
    INSERT INTO renewal_dumps (id, company, upload_date, remarks)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [id, company, upload_date, remarks || '']);

  res.status(201).json({ data: result.rows[0] });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const result = await query(`
    DELETE FROM renewal_dumps
    WHERE id = $1
    RETURNING id
  `, [req.params.id]);

  if (!result.rows.length) return res.status(404).json({ error: 'Renewal dump not found' });
  res.json({ message: 'Deleted', id: req.params.id });
});

export default router;
