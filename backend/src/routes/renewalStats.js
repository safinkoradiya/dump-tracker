import { Router } from 'express';
import { query } from '../db/pool.js';
import { decorateRenewal } from '../lib/renewals.js';

const router = Router();

async function activeRenewals() {
  const result = await query(`
    SELECT r.*
    FROM renewals r
    WHERE r.deleted_at IS NULL
  `);
  return result.rows.map(decorateRenewal);
}

router.get('/', async (req, res) => {
  const [dumpRes, renewals] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total FROM renewal_dumps`),
    activeRenewals(),
  ]);

  const dueSoon = renewals.filter((row) => row.is_due_soon).length;
  const expired = renewals.filter((row) => row.is_expired).length;
  const renewed = renewals.filter((row) => row.status === 'Renewed').length;
  const noResponse = renewals.filter((row) => row.customer_response === 'No Response').length;

  res.json({
    data: {
      totalDumps: dumpRes.rows[0].total,
      totalRenewals: renewals.length,
      dueSoon,
      expired,
      renewed,
      noResponse,
    },
  });
});

router.get('/buckets', async (req, res) => {
  const renewals = await activeRenewals();
  const counts = renewals.reduce((acc, row) => {
    acc[row.bucket] = (acc[row.bucket] || 0) + 1;
    return acc;
  }, {});

  res.json({ data: counts });
});

router.get('/rm', async (req, res) => {
  const renewals = await activeRenewals();
  const grouped = renewals.reduce((acc, row) => {
    const key = row.rm_name || 'Unassigned';
    acc[key] ||= { rm_name: key, total: 0, renewed: 0, dueSoon: 0, expired: 0, noResponse: 0 };
    acc[key].total += 1;
    if (row.status === 'Renewed') acc[key].renewed += 1;
    if (row.is_due_soon) acc[key].dueSoon += 1;
    if (row.is_expired) acc[key].expired += 1;
    if (row.customer_response === 'No Response') acc[key].noResponse += 1;
    return acc;
  }, {});

  res.json({
    data: Object.values(grouped).sort((a, b) => b.total - a.total),
  });
});

router.get('/customers', async (req, res) => {
  const renewals = await activeRenewals();
  const grouped = renewals.reduce((acc, row) => {
    const key = row.customer_response || 'No Response';
    acc[key] ||= { customer_response: key, total: 0 };
    acc[key].total += 1;
    return acc;
  }, {});

  res.json({
    data: Object.values(grouped).sort((a, b) => b.total - a.total),
  });
});

export default router;
