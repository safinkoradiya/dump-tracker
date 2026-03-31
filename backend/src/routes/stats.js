import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

// GET /api/stats — dashboard summary counts
router.get('/', async (req, res) => {
  const [dumpsRes, policiesRes] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total FROM dumps`),
    query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE rm_resolved AND company_resolved)::int AS resolved,
        COUNT(*) FILTER (WHERE NOT (rm_resolved AND company_resolved))::int AS pending
      FROM policies
    `)
  ]);

  const { total: totalDumps } = dumpsRes.rows[0];
  const { total: totalPolicies, resolved, pending } = policiesRes.rows[0];
  const pct = totalPolicies > 0 ? Math.round(resolved / totalPolicies * 100) : 0;

  res.json({ data: { totalDumps, totalPolicies, resolved, pending, resolutionPct: pct } });
});

// GET /api/stats/buckets — aging breakdown for pending policies
router.get('/buckets', async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) FILTER (
        WHERE NOT (rm_resolved AND company_resolved)
          AND recv_date IS NOT NULL
          AND CURRENT_DATE - recv_date::date < 3
      )::int AS hot,
      COUNT(*) FILTER (
        WHERE NOT (rm_resolved AND company_resolved)
          AND recv_date IS NOT NULL
          AND CURRENT_DATE - recv_date::date BETWEEN 3 AND 15
      )::int AS warm,
      COUNT(*) FILTER (
        WHERE NOT (rm_resolved AND company_resolved)
          AND recv_date IS NOT NULL
          AND CURRENT_DATE - recv_date::date > 15
      )::int AS cold
    FROM policies
  `);
  res.json({ data: result.rows[0] });
});

// GET /api/stats/rm — per-RM breakdown
router.get('/rm', async (req, res) => {
  const result = await query(`
    SELECT
      rm_name,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE rm_resolved)::int AS rm_resolved_count,
      COUNT(*) FILTER (WHERE rm_resolved AND company_resolved)::int AS fully_resolved,
      COUNT(*) FILTER (WHERE NOT (rm_resolved AND company_resolved))::int AS pending
    FROM policies
    WHERE rm_name <> ''
    GROUP BY rm_name
    ORDER BY total DESC
  `);
  res.json({ data: result.rows });
});

export default router;