import { Router } from 'express';
import { query } from '../db/pool.js';
import { nextDumpId, ensureSequences } from '../db/sequences.js';

const router = Router();

// GET /api/dumps — list all dumps with live progress
router.get('/', async (req, res) => {
  const { company, status } = req.query;

  let sql = `
    SELECT
      d.*,
      COUNT(p.id)::int                                          AS total_policies,
      COUNT(p.id) FILTER (WHERE p.rm_resolved AND p.company_resolved)::int AS resolved_count,
      CASE
        WHEN COUNT(p.id) = 0 THEN 'Pending'
        WHEN COUNT(p.id) FILTER (WHERE p.rm_resolved AND p.company_resolved) = COUNT(p.id) THEN 'Completed'
        WHEN COUNT(p.id) FILTER (WHERE p.rm_resolved AND p.company_resolved) > 0 THEN 'In Progress'
        ELSE 'Pending'
      END AS status
    FROM dumps d
    LEFT JOIN policies p ON p.dump_id = d.id
  `;
  const params = [];
  const where = [];

  if (company) { params.push(company); where.push(`d.company ILIKE $${params.length}`); }

  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' GROUP BY d.id ORDER BY d.created_at DESC';

  const result = await query(sql, params);

  // Filter by status after aggregation
  const rows = status
    ? result.rows.filter(r => r.status === status)
    : result.rows;

  res.json({ data: rows });
});

// GET /api/dumps/:id — single dump with progress
router.get('/:id', async (req, res) => {
  const result = await query(`
    SELECT
      d.*,
      COUNT(p.id)::int AS total_policies,
      COUNT(p.id) FILTER (WHERE p.rm_resolved AND p.company_resolved)::int AS resolved_count
    FROM dumps d
    LEFT JOIN policies p ON p.dump_id = d.id
    WHERE d.id = $1
    GROUP BY d.id
  `, [req.params.id]);

  if (!result.rows.length) return res.status(404).json({ error: 'Dump not found' });
  res.json({ data: result.rows[0] });
});

// POST /api/dumps — create a new dump
router.post('/', async (req, res) => {
  await ensureSequences();
  const { company, upload_date, remarks } = req.body;
  if (!company) return res.status(400).json({ error: 'company is required' });
  if (!upload_date) return res.status(400).json({ error: 'upload_date is required' });

  const id = await nextDumpId();
  const result = await query(
    `INSERT INTO dumps (id, company, upload_date, remarks)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [id, company, upload_date, remarks || '']
  );
  res.status(201).json({ data: result.rows[0] });
});

// PATCH /api/dumps/:id — update dump details
router.patch('/:id', async (req, res) => {
  const { company, upload_date, remarks } = req.body;
  const result = await query(`
    UPDATE dumps SET
      company     = COALESCE($1, company),
      upload_date = COALESCE($2, upload_date),
      remarks     = COALESCE($3, remarks)
    WHERE id = $4 RETURNING *
  `, [company, upload_date, remarks, req.params.id]);

  if (!result.rows.length) return res.status(404).json({ error: 'Dump not found' });
  res.json({ data: result.rows[0] });
});

// DELETE /api/dumps/:id — cascades to policies
router.delete('/:id', async (req, res) => {
  const result = await query('DELETE FROM dumps WHERE id=$1 RETURNING id', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Dump not found' });
  res.json({ message: 'Deleted', id: req.params.id });
});

export default router;