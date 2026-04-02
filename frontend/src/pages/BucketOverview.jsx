import { useState } from 'react';
import { getPolicies, getBuckets } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { StatCard, Loading, ErrorMsg, Pagination } from '../components/UI.jsx';
import PoliciesTable from '../components/PoliciesTable.jsx';

const PAGE_SIZE = 25;

function PolicyBucketSection({ bucket, label, badgeClass, total, onStatsReload }) {
  const [page, setPage] = useState(1);
  const res = useApi(() => getPolicies({ status: 'Pending', bucket, page, limit: PAGE_SIZE }), [bucket, page]);

  return (
    <div className="card bucket-section">
      <div className="card-header">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${badgeClass}`}>{label}</span> {total} Policies
        </div>
      </div>
      {res.loading ? <Loading /> : res.error ? <ErrorMsg msg={res.error} /> : (
        <>
          <PoliciesTable policies={res.data || []} onUpdated={() => { res.reload(); onStatsReload(); }} />
          <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function BucketOverview() {
  const buckets = useApi(() => getBuckets());
  const b = buckets.data || {};

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Bucket Overview</div>
          <div className="page-desc">Pending policies grouped by how long they've been open</div>
        </div>
      </div>

      <div className="stats-bar three">
        <StatCard label="< 3 Days — Fresh" value={b.hot ?? '–'} sub="Act soon" variant="green" />
        <StatCard label="3–15 Days — Follow up" value={b.warm ?? '–'} sub="Needs attention" variant="accent" />
        <StatCard label="> 15 Days — Overdue" value={b.cold ?? '–'} sub="Escalate now" variant="red" />
      </div>

      {buckets.loading ? <Loading /> : buckets.error ? <ErrorMsg msg={buckets.error} /> : (
        <div className="content">
          {(b.hot || 0) > 0 && (
            <PolicyBucketSection bucket="hot" label="< 3 Days" badgeClass="hot" total={b.hot || 0} onStatsReload={buckets.reload} />
          )}
          {(b.warm || 0) > 0 && (
            <PolicyBucketSection bucket="warm" label="3–15 Days" badgeClass="warm" total={b.warm || 0} onStatsReload={buckets.reload} />
          )}
          {(b.cold || 0) > 0 && (
            <PolicyBucketSection bucket="cold" label="> 15 Days" badgeClass="cold" total={b.cold || 0} onStatsReload={buckets.reload} />
          )}
        </div>
      )}
    </>
  );
}
