import { useState } from 'react';
import { getRenewalBuckets, getRenewals } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { RENEWAL_BUCKET_LABELS, renewalBucketClass, renewalBucketVariant } from '../lib/renewalUtils.js';
import { EmptyState, Loading, ErrorMsg, StatCard, Pagination } from '../components/UI.jsx';
import RenewalTable from '../components/RenewalTable.jsx';

const ORDER = [
  'due_today',
  'due_1_7',
  'due_8_15',
  'due_16_30',
  'due_31_plus',
  'expired_1_15',
  'expired_16_30',
  'expired_30_plus',
];

const PAGE_SIZE = 25;

function RenewalBucketSection({ bucket, total, onStatsReload }) {
  const [page, setPage] = useState(1);
  const renewals = useApi(() => getRenewals({ bucket, page, limit: PAGE_SIZE }), [bucket, page]);

  return (
    <div className="card bucket-section">
      <div className="card-header">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${renewalBucketClass(bucket)}`}>{RENEWAL_BUCKET_LABELS[bucket]}</span>
          {total} Records
        </div>
      </div>
      {renewals.loading ? <Loading /> : renewals.error ? <ErrorMsg msg={renewals.error} /> : (
        <>
          <RenewalTable renewals={renewals.data || []} onUpdated={() => { renewals.reload(); onStatsReload(); }} />
          <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function RenewalBucketOverview() {
  const buckets = useApi(() => getRenewalBuckets());
  const data = buckets.data || {};
  const sections = ORDER
    .map((bucket) => ({ bucket, total: data[bucket] || 0 }))
    .filter((section) => section.total > 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Renewal Buckets</div>
          <div className="page-desc">See upcoming and expired renewals grouped by days to policy expiry</div>
        </div>
      </div>

      <div className="stats-bar" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        {ORDER.map((bucket) => (
          <StatCard
            key={bucket}
            label={RENEWAL_BUCKET_LABELS[bucket]}
            value={data[bucket] ?? 0}
            variant={renewalBucketVariant(bucket)}
          />
        ))}
      </div>

      {buckets.loading ? <Loading /> : buckets.error ? (
        <ErrorMsg msg={buckets.error} />
      ) : (
        <div className="content">
          {sections.length === 0 ? (
            <EmptyState text="No active renewal buckets found" hint="Upload renewal data to see due and expired policy groups" />
          ) : sections.map(({ bucket, total }) => (
            <RenewalBucketSection key={bucket} bucket={bucket} total={total} onStatsReload={buckets.reload} />
          ))}
        </div>
      )}
    </>
  );
}
