import { getRenewalRMStats } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { EmptyState, ErrorMsg, Loading, ProgressBar } from '../components/UI.jsx';

export default function RenewalRMTracking() {
  const res = useApi(() => getRenewalRMStats());
  const rows = res.data || [];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Renewal RM Tracking</div>
          <div className="page-desc">Track RM performance on upcoming and expired renewals</div>
        </div>
      </div>

      {res.loading && <Loading />}
      {res.error && <ErrorMsg msg={res.error} />}
      {!res.loading && !res.error && (
        rows.length === 0
          ? <div className="content"><EmptyState text="No RMs found" hint="Upload renewal records with RM fields to track ownership" /></div>
          : (
            <div className="content">
              <div className="rm-grid">
                {rows.map((rm) => {
                  const initials = rm.rm_name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={rm.rm_name} className="rm-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div className="rm-avatar">{initials}</div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{rm.rm_name}</div>
                      </div>
                      <div className="rm-stat-row"><span className="rm-stat-label">Total</span><span className="rm-stat-val">{rm.total}</span></div>
                      <div className="rm-stat-row"><span className="rm-stat-label">Renewed</span><span className="rm-stat-val" style={{ color: 'var(--green)' }}>{rm.renewed}</span></div>
                      <div className="rm-stat-row"><span className="rm-stat-label">Due Soon</span><span className="rm-stat-val" style={{ color: 'var(--accent)' }}>{rm.dueSoon}</span></div>
                      <div className="rm-stat-row"><span className="rm-stat-label">Expired</span><span className="rm-stat-val" style={{ color: 'var(--red)' }}>{rm.expired}</span></div>
                      <div className="rm-stat-row"><span className="rm-stat-label">No Response</span><span className="rm-stat-val" style={{ color: 'var(--amber)' }}>{rm.noResponse}</span></div>
                      <div style={{ marginTop: 10 }}>
                        <ProgressBar resolved={rm.renewed} total={rm.total} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
      )}
    </>
  );
}
