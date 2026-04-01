import { Router } from 'express';
import { query } from '../db/pool.js';
import { applyAssignedRmScope, hasAssignedRmScope, scopedRmExpression } from '../lib/access.js';
import { requireDiscrepancyRmAccess, requireDiscrepancyView } from '../middleware/auth.js';

const router = Router();

// GET /api/stats — dashboard summary counts
router.get('/', requireDiscrepancyView, async (req, res) => {
  const params = [];
  const where = ['deleted_at IS NULL'];
  applyAssignedRmScope(req.user, params, where, 'rm_name');
  const policyWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [dumpsRes, policiesRes] = await Promise.all([
    hasAssignedRmScope(req.user)
      ? query(
          `SELECT COUNT(DISTINCT dump_id)::int AS total
           FROM policies
           ${policyWhere}`,
          params
        )
      : query(`SELECT COUNT(*)::int AS total FROM dumps`),
    query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE rm_resolved AND company_resolved)::int AS resolved,
        COUNT(*) FILTER (WHERE NOT (rm_resolved AND company_resolved))::int AS pending
      FROM policies
      ${policyWhere}
    `, params)
  ]);

  const { total: totalDumps } = dumpsRes.rows[0];
  const { total: totalPolicies, resolved, pending } = policiesRes.rows[0];
  const pct = totalPolicies > 0 ? Math.round(resolved / totalPolicies * 100) : 0;

  res.json({ data: { totalDumps, totalPolicies, resolved, pending, resolutionPct: pct } });
});

// GET /api/stats/buckets — aging breakdown for pending policies
router.get('/buckets', requireDiscrepancyView, async (req, res) => {
  const params = [];
  const where = [`deleted_at IS NULL`, `NOT (rm_resolved AND company_resolved)`, `recv_date IS NOT NULL`];
  applyAssignedRmScope(req.user, params, where, 'rm_name');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await query(`
    SELECT
      COUNT(*) FILTER (
        WHERE CURRENT_DATE - recv_date::date < 3
      )::int AS hot,
      COUNT(*) FILTER (
        WHERE CURRENT_DATE - recv_date::date BETWEEN 3 AND 15
      )::int AS warm,
      COUNT(*) FILTER (
        WHERE CURRENT_DATE - recv_date::date > 15
      )::int AS cold
    FROM policies
    ${whereSql}
  `, params);
  res.json({ data: result.rows[0] });
});

// GET /api/stats/rm — per-RM breakdown
router.get('/rm', requireDiscrepancyRmAccess, async (req, res) => {
  const params = [];
  const where = [`deleted_at IS NULL`, `rm_name <> ''`];
  applyAssignedRmScope(req.user, params, where, scopedRmExpression());
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await query(`
    SELECT
      rm_name,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE rm_resolved)::int AS rm_resolved_count,
      COUNT(*) FILTER (WHERE rm_resolved AND company_resolved)::int AS fully_resolved,
      COUNT(*) FILTER (WHERE NOT (rm_resolved AND company_resolved))::int AS pending
    FROM policies
    ${whereSql}
    GROUP BY rm_name
    ORDER BY total DESC
  `, params);
  res.json({ data: result.rows });
});

export default router;
