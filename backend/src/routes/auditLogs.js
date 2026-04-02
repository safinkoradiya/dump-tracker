import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

router.get('/', requireAdmin, async (req, res) => {
  const {
    actor = '',
    action = '',
    entity_type = '',
    search = '',
    page = 1,
    limit = DEFAULT_LIMIT,
  } = req.query;

  const pageNum = parsePositiveInt(page, 1);
  const limitNum = Math.min(parsePositiveInt(limit, DEFAULT_LIMIT), MAX_LIMIT);
  const offset = (pageNum - 1) * limitNum;

  const params = [];
  const where = [];

  if (actor) {
    params.push(`%${actor}%`);
    where.push(`actor_username ILIKE $${params.length}`);
  }
  if (action) {
    params.push(action);
    where.push(`action = $${params.length}`);
  }
  if (entity_type) {
    params.push(entity_type);
    where.push(`entity_type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    where.push(`(
      actor_username ILIKE $${idx}
      OR action ILIKE $${idx}
      OR entity_type ILIKE $${idx}
      OR entity_label ILIKE $${idx}
      OR details::text ILIKE $${idx}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dataParams = [...params, limitNum, offset];

  const [rowsRes, countRes, actionsRes, entityTypesRes] = await Promise.all([
    query(
      `SELECT *
       FROM audit_logs
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM audit_logs
       ${whereSql}`,
      params
    ),
    query(`SELECT DISTINCT action FROM audit_logs ORDER BY action ASC`),
    query(`SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type ASC`),
  ]);

  const total = countRes.rows[0]?.total || 0;

  res.json({
    data: rowsRes.rows,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
    meta: {
      actions: actionsRes.rows.map((row) => row.action),
      entityTypes: entityTypesRes.rows.map((row) => row.entity_type),
    },
  });
});

export default router;
