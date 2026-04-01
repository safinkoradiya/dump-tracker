import { Router } from 'express';
import { query } from '../db/pool.js';
import { nextRenewalDumpId, ensureSequences } from '../db/sequences.js';
import { applyAssignedRmScope, hasAssignedRmScope, scopedRmExpression } from '../lib/access.js';
import { requireDataManage, requireRenewalView } from '../middleware/auth.js';

const router = Router();

function buildJoin(user, alias = 'r', initialParams = []) {
  const params = [...initialParams];
  const joinConditions = [`${alias}.renewal_dump_id = d.id`];
  if (hasAssignedRmScope(user)) {
    applyAssignedRmScope(user, params, joinConditions, scopedRmExpression(alias));
  }
  return {
    params,
    joinSql: `LEFT JOIN renewals ${alias} ON ${joinConditions.join(' AND ')}`,
  };
}

function statusCase() {
  return `
    CASE
      WHEN COUNT(r.id) FILTER (WHERE r.deleted_at IS NULL) = 0 THEN 'Pending'
      WHEN COUNT(r.id) FILTER (WHERE r.deleted_at IS NULL AND r.status = 'Renewed') = COUNT(r.id) FILTER (WHERE r.deleted_at IS NULL) THEN 'Completed'
      WHEN COUNT(r.id) FILTER (WHERE r.deleted_at IS NULL AND r.status = 'Renewed') > 0 THEN 'In Progress'
      ELSE 'Pending'
    END AS status
  `;
}

router.get('/', requireRenewalView, async (req, res) => {
  const { params, joinSql } = buildJoin(req.user);
  const havingSql = hasAssignedRmScope(req.user) ? 'HAVING COUNT(r.id) > 0' : '';

  const result = await query(
    `SELECT
       d.*,
       COUNT(r.id) FILTER (WHERE r.deleted_at IS NULL)::int AS total_renewals,
       COUNT(r.id) FILTER (WHERE r.deleted_at IS NULL AND r.status = 'Renewed')::int AS renewed_count,
       COUNT(r.id) FILTER (
         WHERE r.deleted_at IS NULL
           AND r.status <> 'Renewed'
           AND r.policy_valid_till IS NOT NULL
           AND r.policy_valid_till >= CURRENT_DATE
           AND r.policy_valid_till <= CURRENT_DATE + 30
       )::int AS due_soon_count,
       COUNT(r.id) FILTER (
         WHERE r.deleted_at IS NULL
           AND r.status <> 'Renewed'
           AND r.policy_valid_till IS NOT NULL
           AND r.policy_valid_till < CURRENT_DATE
       )::int AS expired_count,
       COUNT(r.id) FILTER (WHERE r.deleted_at IS NOT NULL)::int AS deleted_renewals,
       ${statusCase()}
     FROM renewal_dumps d
     ${joinSql}
     GROUP BY d.id
     ${havingSql}
     ORDER BY d.created_at DESC`,
    params
  );

  res.json({ data: result.rows });
});

router.get('/:id', requireRenewalView, async (req, res) => {
  const { params, joinSql } = buildJoin(req.user, 'r', [req.params.id]);

  const result = await query(
    `SELECT
       d.*,
       COUNT(r.id) FILTER (WHERE r.deleted_at IS NULL)::int AS total_renewals,
       COUNT(r.id) FILTER (WHERE r.deleted_at IS NULL AND r.status = 'Renewed')::int AS renewed_count,
       COUNT(r.id) FILTER (
         WHERE r.deleted_at IS NULL
           AND r.status <> 'Renewed'
           AND r.policy_valid_till IS NOT NULL
           AND r.policy_valid_till >= CURRENT_DATE
           AND r.policy_valid_till <= CURRENT_DATE + 30
       )::int AS due_soon_count,
       COUNT(r.id) FILTER (
         WHERE r.deleted_at IS NULL
           AND r.status <> 'Renewed'
           AND r.policy_valid_till IS NOT NULL
           AND r.policy_valid_till < CURRENT_DATE
       )::int AS expired_count,
       COUNT(r.id) FILTER (WHERE r.deleted_at IS NOT NULL)::int AS deleted_renewals,
       ${statusCase()}
     FROM renewal_dumps d
     ${joinSql}
     WHERE d.id = $1
     GROUP BY d.id`,
    params
  );

  if (!result.rows.length) return res.status(404).json({ error: 'Renewal dump not found' });
  res.json({ data: result.rows[0] });
});

router.post('/', requireDataManage, async (req, res) => {
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

router.delete('/:id', requireDataManage, async (req, res) => {
  const result = await query(`
    DELETE FROM renewal_dumps
    WHERE id = $1
    RETURNING id
  `, [req.params.id]);

  if (!result.rows.length) return res.status(404).json({ error: 'Renewal dump not found' });
  res.json({ message: 'Deleted', id: req.params.id });
});

export default router;
