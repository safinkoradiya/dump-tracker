import { Router } from 'express';
import { query } from '../db/pool.js';
import { applyAssignedRmScope, hasAssignedRmScope, scopedRmExpression } from '../lib/access.js';
import { requireRenewalRmAccess, requireRenewalView } from '../middleware/auth.js';

const router = Router();

function buildRenewalScope(user, alias = 'r', includeDeleted = false) {
  const params = [];
  const where = [];
  if (!includeDeleted) where.push(`${alias}.deleted_at IS NULL`);
  applyAssignedRmScope(user, params, where, scopedRmExpression(alias));
  return {
    params,
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
  };
}

router.get('/', requireRenewalView, async (req, res) => {
  const { params, whereSql } = buildRenewalScope(req.user);

  const [dumpRes, statsRes] = await Promise.all([
    hasAssignedRmScope(req.user)
      ? query(
          `SELECT COUNT(DISTINCT r.renewal_dump_id)::int AS total
           FROM renewals r
           ${whereSql}`,
          params
        )
      : query(`SELECT COUNT(*)::int AS total FROM renewal_dumps`),
    query(
      `SELECT
         COUNT(*)::int AS total_renewals,
         COUNT(*) FILTER (
           WHERE status = 'Renewed'
         )::int AS renewed,
         COUNT(*) FILTER (
           WHERE status <> 'Renewed'
             AND policy_valid_till IS NOT NULL
             AND policy_valid_till >= CURRENT_DATE
             AND policy_valid_till <= CURRENT_DATE + 30
         )::int AS due_soon,
         COUNT(*) FILTER (
           WHERE status <> 'Renewed'
             AND policy_valid_till IS NOT NULL
             AND policy_valid_till < CURRENT_DATE
         )::int AS expired,
         COUNT(*) FILTER (
           WHERE COALESCE(customer_response, 'No Response') = 'No Response'
         )::int AS no_response
       FROM renewals r
       ${whereSql}`,
      params
    ),
  ]);

  res.json({
    data: {
      totalDumps: dumpRes.rows[0].total,
      totalRenewals: statsRes.rows[0].total_renewals,
      dueSoon: statsRes.rows[0].due_soon,
      expired: statsRes.rows[0].expired,
      renewed: statsRes.rows[0].renewed,
      noResponse: statsRes.rows[0].no_response,
    },
  });
});

router.get('/buckets', requireRenewalView, async (req, res) => {
  const { params, whereSql } = buildRenewalScope(req.user);

  const result = await query(
    `SELECT
       COUNT(*) FILTER (
         WHERE status = 'Renewed'
       )::int AS renewed,
       COUNT(*) FILTER (
         WHERE policy_valid_till IS NULL
           AND status <> 'Renewed'
       )::int AS unknown,
       COUNT(*) FILTER (
         WHERE status <> 'Renewed'
           AND policy_valid_till = CURRENT_DATE
       )::int AS due_today,
       COUNT(*) FILTER (
         WHERE status <> 'Renewed'
           AND policy_valid_till > CURRENT_DATE
           AND policy_valid_till <= CURRENT_DATE + 7
       )::int AS due_1_7,
       COUNT(*) FILTER (
         WHERE status <> 'Renewed'
           AND policy_valid_till > CURRENT_DATE + 7
           AND policy_valid_till <= CURRENT_DATE + 15
       )::int AS due_8_15,
       COUNT(*) FILTER (
         WHERE status <> 'Renewed'
           AND policy_valid_till > CURRENT_DATE + 15
           AND policy_valid_till <= CURRENT_DATE + 30
       )::int AS due_16_30,
       COUNT(*) FILTER (
         WHERE status <> 'Renewed'
           AND policy_valid_till > CURRENT_DATE + 30
       )::int AS due_31_plus,
       COUNT(*) FILTER (
         WHERE status <> 'Renewed'
           AND policy_valid_till < CURRENT_DATE
           AND policy_valid_till >= CURRENT_DATE - 15
       )::int AS expired_1_15,
       COUNT(*) FILTER (
         WHERE status <> 'Renewed'
           AND policy_valid_till < CURRENT_DATE - 15
           AND policy_valid_till >= CURRENT_DATE - 30
       )::int AS expired_16_30,
       COUNT(*) FILTER (
         WHERE status <> 'Renewed'
           AND policy_valid_till < CURRENT_DATE - 30
       )::int AS expired_30_plus
     FROM renewals r
     ${whereSql}`,
    params
  );

  res.json({ data: result.rows[0] });
});

router.get('/rm', requireRenewalRmAccess, async (req, res) => {
  const { params, whereSql } = buildRenewalScope(req.user);

  const result = await query(
    `SELECT
       COALESCE(NULLIF(rm_name, ''), 'Unassigned') AS rm_name,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'Renewed')::int AS renewed,
       COUNT(*) FILTER (
         WHERE status <> 'Renewed'
           AND policy_valid_till IS NOT NULL
           AND policy_valid_till >= CURRENT_DATE
           AND policy_valid_till <= CURRENT_DATE + 30
       )::int AS "dueSoon",
       COUNT(*) FILTER (
         WHERE status <> 'Renewed'
           AND policy_valid_till IS NOT NULL
           AND policy_valid_till < CURRENT_DATE
       )::int AS expired,
       COUNT(*) FILTER (
         WHERE COALESCE(customer_response, 'No Response') = 'No Response'
       )::int AS "noResponse"
     FROM renewals r
     ${whereSql}
     GROUP BY COALESCE(NULLIF(rm_name, ''), 'Unassigned')
     ORDER BY total DESC, rm_name ASC`,
    params
  );

  res.json({ data: result.rows });
});

router.get('/customers', requireRenewalView, async (req, res) => {
  const { params, whereSql } = buildRenewalScope(req.user);

  const result = await query(
    `SELECT
       COALESCE(NULLIF(customer_response, ''), 'No Response') AS customer_response,
       COUNT(*)::int AS total
     FROM renewals r
     ${whereSql}
     GROUP BY COALESCE(NULLIF(customer_response, ''), 'No Response')
     ORDER BY total DESC, customer_response ASC`,
    params
  );

  res.json({ data: result.rows });
});

export default router;
