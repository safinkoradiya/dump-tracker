import { useEffect, useState } from 'react';
import { getRenewalCustomerStats, getRenewals } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { CUSTOMER_RESPONSE_OPTIONS } from '../lib/renewalUtils.js';
import { ErrorMsg, Loading, StatCard, Pagination } from '../components/UI.jsx';
import RenewalTable from '../components/RenewalTable.jsx';

const PAGE_SIZE = 50;

export default function RenewalCustomerTracking() {
  const [responseFilter, setResponseFilter] = useState('');
  const [page, setPage] = useState(1);
  const stats = useApi(() => getRenewalCustomerStats());
  const renewals = useApi(() => getRenewals({
    ...(responseFilter ? { customer_response: responseFilter } : {}),
    page,
    limit: PAGE_SIZE,
  }), [responseFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [responseFilter]);

  const rows = renewals.data || [];
  const total = renewals.response?.total ?? rows.length;
  const counts = Object.fromEntries((stats.data || []).map((row) => [row.customer_response, row.total]));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Customer Tracking</div>
          <div className="page-desc">Track customer response quality across all renewal opportunities</div>
        </div>
      </div>

      <div className="stats-bar" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {CUSTOMER_RESPONSE_OPTIONS.map((option) => (
          <StatCard
            key={option}
            label={option}
            value={counts[option] ?? 0}
            variant={option === 'Renewed' ? 'green' : option === 'Rejected' ? 'red' : option === 'No Response' ? 'amber' : 'accent'}
            onClick={() => setResponseFilter(option)}
          />
        ))}
      </div>

      <div className="content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{total} Renewal Records</div>
            <div className="filter-bar">
              <select className="filter-select" value={responseFilter} onChange={(e) => setResponseFilter(e.target.value)}>
                <option value="">All Responses</option>
                {CUSTOMER_RESPONSE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
          </div>
          {(stats.loading || renewals.loading) ? <Loading /> : (stats.error || renewals.error) ? (
            <ErrorMsg msg={stats.error || renewals.error} />
          ) : (
            <>
              <RenewalTable renewals={rows} onUpdated={() => { stats.reload(); renewals.reload(); }} />
              <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
