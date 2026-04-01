import { getRenewalBuckets, getRenewals } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { RENEWAL_BUCKET_LABELS, decorateRenewal, renewalBucketClass, renewalBucketVariant } from '../lib/renewalUtils.js';
import { EmptyState, Loading, ErrorMsg, StatCard } from '../components/UI.jsx';
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

export default function RenewalBucketOverview() {
  const buckets = useApi(() => getRenewalBuckets());
  const renewals = useApi(() => getRenewals({ limit: 1000 }));

  const data = (renewals.data || []).map(decorateRenewal).filter((item) => item.status !== 'Renewed');
  const sections = ORDER
    .map((bucket) => ({ bucket, rows: data.filter((item) => item.bucket === bucket) }))
    .filter((section) => section.rows.length > 0);

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
            value={(buckets.data || {})[bucket] ?? 0}
            variant={renewalBucketVariant(bucket)}
          />
        ))}
      </div>

      {(buckets.loading || renewals.loading) ? <Loading /> : (buckets.error || renewals.error) ? (
        <ErrorMsg msg={buckets.error || renewals.error} />
      ) : (
        <div className="content">
          {sections.length === 0 ? (
            <EmptyState text="No active renewal buckets found" hint="Upload renewal data to see due and expired policy groups" />
          ) : sections.map(({ bucket, rows }) => (
              <div key={bucket} className="card bucket-section">
                <div className="card-header">
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${renewalBucketClass(bucket)}`}>{RENEWAL_BUCKET_LABELS[bucket]}</span>
                    {rows.length} Records
                  </div>
                </div>
                <RenewalTable renewals={rows} onUpdated={() => { renewals.reload(); buckets.reload(); }} />
              </div>
            ))
          }
        </div>
      )}
    </>
  );
}
