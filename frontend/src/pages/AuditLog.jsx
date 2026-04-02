import { useEffect, useState } from 'react';
import { getAuditLogs } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { ErrorMsg, Loading, Pagination } from '../components/UI.jsx';
import { fmtDate } from '../lib/utils.js';

const PAGE_SIZE = 50;

function summaryText(log) {
  if (log.details?.summary) return log.details.summary;
  if (log.entity_label) return log.entity_label;
  return '—';
}

export default function AuditLog() {
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const logs = useApi(() => getAuditLogs({
    ...(actor ? { actor } : {}),
    ...(action ? { action } : {}),
    ...(entityType ? { entity_type: entityType } : {}),
    ...(search ? { search } : {}),
    page,
    limit: PAGE_SIZE,
  }), [actor, action, entityType, search, page]);

  useEffect(() => {
    setPage(1);
  }, [actor, action, entityType, search]);

  const rows = logs.data || [];
  const total = logs.response?.total ?? rows.length;
  const actions = logs.response?.meta?.actions || [];
  const entityTypes = logs.response?.meta?.entityTypes || [];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Audit Log</div>
          <div className="page-desc">Track who changed users, dumps, policies, renewals, imports, and exports</div>
        </div>
      </div>

      <div className="content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{total} Events</div>
            <div className="filter-bar">
              <input className="search-input" placeholder="Search actor or summary…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <input className="search-input" placeholder="Filter by actor…" value={actor} onChange={(e) => setActor(e.target.value)} />
              <select className="filter-select" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">All Actions</option>
                {actions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select className="filter-select" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                <option value="">All Entities</option>
                {entityTypes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
          {logs.loading ? <Loading /> : logs.error ? <ErrorMsg msg={logs.error} /> : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Target</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((log) => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(log.created_at)}<div style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(log.created_at).toLocaleTimeString()}</div></td>
                        <td>
                          <strong>{log.actor_username}</strong>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{log.actor_role}</div>
                        </td>
                        <td><span className="mono">{log.action}</span></td>
                        <td>{log.entity_type}</td>
                        <td>
                          <div>{log.entity_label || '—'}</div>
                          {log.entity_id ? <div style={{ fontSize: 11, color: 'var(--text3)' }} className="mono">{log.entity_id}</div> : null}
                        </td>
                        <td>
                          <div>{summaryText(log)}</div>
                          {log.details && Object.keys(log.details).length > 0 ? (
                            <details style={{ marginTop: 6 }}>
                              <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--accent)' }}>Details</summary>
                              <pre style={{ marginTop: 8, padding: 10, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
