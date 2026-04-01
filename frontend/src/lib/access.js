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

export function getAuthState() {
  let permissions = EMPTY_PERMISSIONS;
  try {
    permissions = normalizePermissions(JSON.parse(localStorage.getItem('permissions') || '{}'));
  } catch {
    permissions = EMPTY_PERMISSIONS;
  }

  return {
    token: localStorage.getItem('token') || '',
    username: localStorage.getItem('username') || '',
    role: localStorage.getItem('role') || 'user',
    assignedRm: localStorage.getItem('assigned_rm') || '',
    permissions,
  };
}

export function storeAuthState(data) {
  localStorage.setItem('token', data.token || '');
  localStorage.setItem('role', data.role || 'user');
  localStorage.setItem('username', data.username || '');
  localStorage.setItem('permissions', JSON.stringify(normalizePermissions(data.permissions)));
  localStorage.setItem('assigned_rm', data.assigned_rm || '');
}

export function clearAuthState() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('username');
  localStorage.removeItem('permissions');
  localStorage.removeItem('assigned_rm');
}

export function isAdmin(auth = getAuthState()) {
  return auth.role === 'admin';
}

export function canManageUsers(auth = getAuthState()) {
  return isAdmin(auth);
}

export function canManageData(auth = getAuthState()) {
  return isAdmin(auth) || auth.permissions.fullAccess;
}

export function canViewDiscrepancyModule(auth = getAuthState()) {
  return canManageData(auth) || auth.permissions.discrepancy.view;
}

export function canViewDiscrepancyRm(auth = getAuthState()) {
  return canViewDiscrepancyModule(auth) || auth.permissions.discrepancy.rmTracking;
}

export function canViewPolicies(auth = getAuthState()) {
  return canViewDiscrepancyRm(auth);
}

export function canViewRenewalModule(auth = getAuthState()) {
  return canManageData(auth) || auth.permissions.renewal.view;
}

export function canViewRenewalRm(auth = getAuthState()) {
  return canViewRenewalModule(auth) || auth.permissions.renewal.rmTracking;
}

export function canViewRenewalList(auth = getAuthState()) {
  return canViewRenewalRm(auth);
}

export function getDefaultRoute(auth = getAuthState()) {
  if (canViewDiscrepancyModule(auth)) return '/';
  if (canViewDiscrepancyRm(auth)) return '/rm';
  if (canViewRenewalModule(auth)) return '/renewal-dumps';
  if (canViewRenewalRm(auth)) return '/renewals/rm';
  if (canManageUsers(auth)) return '/access';
  return '/no-access';
}
