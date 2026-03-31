import { getRMStats } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { ProgressBar, Loading, ErrorMsg, EmptyState } from '../components/UI.jsx';

export default function RMTracking() {
  const res = useApi(() => getRMStats());
  const rms = res.data || [];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">RM Tracking</div>
          <div className="page-desc">Per-RM resolution performance across all dumps</div>
        </div>
      </div>

      {res.loading && <Loading />}
      {res.error   && <ErrorMsg msg={res.error} />}
      {!res.loading && !res.error && (
        rms.length === 0
          ? <div className="content"><EmptyState text="No RMs found" hint="Add policies with RM names to see tracking" /></div>
          : (
            <div className="content">
              <div className="rm-grid">
                {rms.map(rm => {
                  const pct = rm.total > 0 ? Math.round(rm.fully_resolved / rm.total * 100) : 0;
                  const initials = rm.rm_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={rm.rm_name} className="rm-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div className="rm-avatar">{initials}</div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{rm.rm_name}</div>
                      </div>
                      <div className="rm-stat-row">
                        <span className="rm-stat-label">Total Policies</span>
                        <span className="rm-stat-val">{rm.total}</span>
                      </div>
                      <div className="rm-stat-row">
                        <span className="rm-stat-label">RM Resolved</span>
                        <span className="rm-stat-val" style={{ color: 'var(--accent)' }}>{rm.rm_resolved_count}</span>
                      </div>
                      <div className="rm-stat-row">
                        <span className="rm-stat-label">Fully Resolved</span>
                        <span className="rm-stat-val" style={{ color: 'var(--green)' }}>{rm.fully_resolved}</span>
                      </div>
                      <div className="rm-stat-row">
                        <span className="rm-stat-label">Pending</span>
                        <span className="rm-stat-val" style={{ color: 'var(--amber)' }}>{rm.pending}</span>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <ProgressBar resolved={rm.fully_resolved} total={rm.total} />
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