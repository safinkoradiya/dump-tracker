import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import { getAssignedRm, summarizePermissions } from './access.js';

function firstForwardedIp(value) {
  if (!value) return '';
  if (Array.isArray(value)) return firstForwardedIp(value[0]);
  return String(value).split(',')[0].trim();
}

function getIpAddress(req) {
  return (
    firstForwardedIp(req?.headers?.['x-forwarded-for']) ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    ''
  );
}

function normalizeDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined)
  );
}

export function accessSummary(user) {
  const summary = summarizePermissions(user);
  const assignedRm = getAssignedRm(user);
  return assignedRm ? `${summary} · RM: ${assignedRm}` : summary;
}

export async function recordAuditLog({
  req,
  actor = req?.user,
  action,
  entityType,
  entityId = '',
  entityLabel = '',
  details = {},
}) {
  if (!action || !entityType) return;

  const actorUsername = actor?.username || 'system';
  const actorRole = actor?.role || 'system';
  const payload = normalizeDetails(details);

  try {
    await query(
      `INSERT INTO audit_logs (
         id,
         actor_user_id,
         actor_username,
         actor_role,
         action,
         entity_type,
         entity_id,
         entity_label,
         details,
         ip_address,
         user_agent
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
      [
        randomUUID(),
        actor?.id || null,
        actorUsername,
        actorRole,
        action,
        entityType,
        entityId || '',
        entityLabel || '',
        JSON.stringify(payload),
        getIpAddress(req),
        String(req?.headers?.['user-agent'] || ''),
      ]
    );
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}
