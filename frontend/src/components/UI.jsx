import { progressColor, getBucket } from '../lib/utils.js';

export function StatusBadge({ status }) {
  const cls = { Completed: 'completed', 'In Progress': 'progress', Pending: 'pending', Resolved: 'resolved' };
  return <span className={`badge ${cls[status] || 'pending'}`}>{status}</span>;
}

export function BucketBadge({ days }) {
  if (days === null || days === undefined) return null;
  const b = getBucket(days);
  const labels = { hot: '< 3 days', warm: '3–15 days', cold: '> 15 days' };
  return <span className={`badge ${b}`}>{labels[b]}</span>;
}

export function DaysBadge({ days }) {
  if (days === null || days === undefined) return <span className="days-none">–</span>;
  const cls = days < 3 ? 'days-hot' : days <= 15 ? 'days-warm' : 'days-cold';
  return <span className={cls}>{days}d</span>;
}

export function CheckBadge({ value }) {
  return <span className={value ? 'check-yes' : 'check-no'}>{value ? '✓' : '○'}</span>;
}

export function ProgressBar({ resolved, total }) {
  const pct = total > 0 ? Math.round(resolved / total * 100) : 0;
  const color = progressColor(pct);
  return (
    <div className="progress-wrap">
      <div className="progress-bg">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="progress-pct">{pct}%</span>
    </div>
  );
}

export function StatCard({ label, value, sub, variant, onClick }) {
  return (
    <div className={`stat-card ${variant || ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Loading() {
  return <div className="loading">Loading…</div>;
}

export function ErrorMsg({ msg }) {
  return <div className="error-msg">Error: {msg}</div>;
}

export function EmptyState({ icon = '📋', text, hint }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-text">{text}</div>
      {hint && <div className="empty-hint">{hint}</div>}
    </div>
  );
}