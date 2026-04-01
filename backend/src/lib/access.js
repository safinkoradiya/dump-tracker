const EMPTY_PERMISSIONS = {
  fullAccess: false,
  discrepancy: {
    view: false,
    rmTracking: false,
  },
  renewal: {
    view: false,
    rmTracking: false,
  },
};

function toBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function normalizeRole(role) {
  return role === 'admin' ? 'admin' : 'user';
}

export function normalizePermissions(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const discrepancy = source.discrepancy || {};
  const renewal = source.renewal || {};

  const permissions = {
    fullAccess: toBool(source.fullAccess ?? source.full_access),
    discrepancy: {
      view: toBool(discrepancy.view ?? source.discrepancy_view),
      rmTracking: toBool(discrepancy.rmTracking ?? discrepancy.rm_tracking ?? source.discrepancy_rm_tracking),
    },
    renewal: {
      view: toBool(renewal.view ?? source.renewal_view),
      rmTracking: toBool(renewal.rmTracking ?? renewal.rm_tracking ?? source.renewal_rm_tracking),
    },
  };

  if (permissions.fullAccess) {
    permissions.discrepancy.view = true;
    permissions.discrepancy.rmTracking = true;
    permissions.renewal.view = true;
    permissions.renewal.rmTracking = true;
  }

  return permissions;
}

export function getAssignedRm(user) {
  return String(user?.assigned_rm || user?.assignedRm || '').trim();
}

export function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: normalizeRole(user.role),
    permissions: normalizePermissions(user.permissions),
    assigned_rm: getAssignedRm(user),
    created_at: user.created_at,
  };
}

export function canManageUsers(user) {
  return normalizeRole(user?.role) === 'admin';
}

export function canManageData(user) {
  if (normalizeRole(user?.role) === 'admin') return true;
  return normalizePermissions(user?.permissions).fullAccess;
}

export function canViewDiscrepancyModule(user) {
  if (canManageData(user)) return true;
  return normalizePermissions(user?.permissions).discrepancy.view;
}

export function canViewDiscrepancyRmTracking(user) {
  if (canViewDiscrepancyModule(user)) return true;
  return normalizePermissions(user?.permissions).discrepancy.rmTracking;
}

export function canViewRenewalModule(user) {
  if (canManageData(user)) return true;
  return normalizePermissions(user?.permissions).renewal.view;
}

export function canViewRenewalRmTracking(user) {
  if (canViewRenewalModule(user)) return true;
  return normalizePermissions(user?.permissions).renewal.rmTracking;
}

export function hasAssignedRmScope(user) {
  return !canManageData(user) && Boolean(getAssignedRm(user));
}

export function scopedRmExpression(alias = '') {
  return alias ? `${alias}.rm_name` : 'rm_name';
}

export function applyAssignedRmScope(user, params, where, expression = 'rm_name') {
  if (!hasAssignedRmScope(user)) return;
  params.push(getAssignedRm(user));
  where.push(`${expression} = $${params.length}`);
}

export function summarizePermissions(user) {
  if (normalizeRole(user?.role) === 'admin') return 'Admin';

  const permissions = normalizePermissions(user?.permissions);
  if (permissions.fullAccess) return 'Full access';

  const labels = [];
  if (permissions.discrepancy.view) labels.push('Discrepancy View');
  else if (permissions.discrepancy.rmTracking) labels.push('Discrepancy RM');
  if (permissions.renewal.view) labels.push('Renewal View');
  else if (permissions.renewal.rmTracking) labels.push('Renewal RM');
  return labels.join(', ') || 'No access';
}

export const DEFAULT_PERMISSIONS = EMPTY_PERMISSIONS;
