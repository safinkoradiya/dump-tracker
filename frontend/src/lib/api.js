import { clearAuthState } from './access.js';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function req(method, path, body, file) {
  const url = `${BASE}/api${path}`;
  const token = localStorage.getItem("token"); // ✅ ADD THIS

  const opts = {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }) // ✅ ADD THIS
    }
  };

  if (file) {
    const fd = new FormData();
    fd.append('file', file);
    if (body) Object.entries(body).forEach(([k, v]) => fd.append(k, v));
    opts.body = fd;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Some failed responses may not have a JSON body.
  }
  if (res.status === 401) {
    if (path !== '/auth/login') {
      clearAuthState();
      window.location.href = "/login";
    }
    throw new Error(json?.error || 'Unauthorized');
  }

  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

async function reqBlob(method, path, body) {
  const url = `${BASE}/api${path}`;
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    clearAuthState();
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      message = json.error || message;
    } catch {
      // Fall back to the HTTP status when the response is not JSON.
    }
    throw new Error(message);
  }

  return res.blob();
}

// Dumps
export const getDumps    = (params = {}) => req('GET', '/dumps?' + new URLSearchParams(params));
export const getDump     = (id)           => req('GET', `/dumps/${id}`);
export const createDump  = (body)         => req('POST', '/dumps', body);
export const updateDump  = (id, body)     => req('PATCH', `/dumps/${id}`, body);
export const deleteDump  = (id)           => req('DELETE', `/dumps/${id}`);

// Policies
export const getPolicies   = (params = {}) => req('GET', '/policies?' + new URLSearchParams(params));
export const getPolicy     = (id)           => req('GET', `/policies/${id}`);
export const createPolicy  = (body)         => req('POST', '/policies', body);
export const updatePolicy  = (id, body)     => req('PATCH', `/policies/${id}`, body);
export const deletePolicy  = (id)           => req('DELETE', `/policies/${id}`);
export const importFile    = (dump_id, file) => req('POST', '/policies/import', { dump_id }, file);

// Auth + export
export const login       = (body) => req('POST', '/auth/login', body);
export const getMe       = () => req('GET', '/auth/me');
export const getUsers    = () => req('GET', '/auth/users');
export const registerUser = (body) => req('POST', '/auth/register', body);
export const updateUser  = (id, body) => req('PATCH', `/auth/users/${id}`, body);
export const deleteUserAccount = (id) => req('DELETE', `/auth/users/${id}`);
export const exportExcel = (body) => reqBlob('POST', '/export/excel', body);

// Stats
export const getStats      = ()  => req('GET', '/stats');
export const getBuckets    = ()  => req('GET', '/stats/buckets');
export const getRMStats    = ()  => req('GET', '/stats/rm');

// Renewal dumps
export const getRenewalDumps    = ()              => req('GET', '/renewal-dumps');
export const getRenewalDump     = (id)            => req('GET', `/renewal-dumps/${id}`);
export const createRenewalDump  = (body)          => req('POST', '/renewal-dumps', body);
export const deleteRenewalDump  = (id)            => req('DELETE', `/renewal-dumps/${id}`);

// Renewals
export const getRenewals         = (params = {})  => req('GET', '/renewals?' + new URLSearchParams(params));
export const getRenewal          = (id)           => req('GET', `/renewals/${id}`);
export const updateRenewal       = (id, body)     => req('PATCH', `/renewals/${id}`, body);
export const deleteRenewal       = (id)           => req('DELETE', `/renewals/${id}`);
export const importRenewalFile   = (renewal_dump_id, file) => req('POST', '/renewals/import', { renewal_dump_id }, file);

// Renewal stats + export
export const getRenewalStats         = () => req('GET', '/renewal-stats');
export const getRenewalBuckets       = () => req('GET', '/renewal-stats/buckets');
export const getRenewalRMStats       = () => req('GET', '/renewal-stats/rm');
export const getRenewalCustomerStats = () => req('GET', '/renewal-stats/customers');
export const exportRenewalExcel      = (body) => reqBlob('POST', '/renewal-export/excel', body);
