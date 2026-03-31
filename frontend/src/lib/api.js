const BASE = import.meta.env.VITE_API_URL || '';

async function req(method, path, body, file) {
  const url = `${BASE}/api${path}`;
  const opts = { method, headers: {} };

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
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
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
export const importFile    = (dump_id, file) => req('POST', '/policies/import', { dump_id }, file);

// Stats
export const getStats      = ()  => req('GET', '/stats');
export const getBuckets    = ()  => req('GET', '/stats/buckets');
export const getRMStats    = ()  => req('GET', '/stats/rm');