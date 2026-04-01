import { useState } from 'react';
import { getRenewalCustomerStats, getRenewals } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { CUSTOMER_RESPONSE_OPTIONS, decorateRenewal } from '../lib/renewalUtils.js';
import { ErrorMsg, Loading, StatCard } from '../components/UI.jsx';
import RenewalTable from '../components/RenewalTable.jsx';

export default function RenewalCustomerTracking() {
  const [responseFilter, setResponseFilter] = useState('');
  const stats = useApi(() => getRenewalCustomerStats());
  const renewals = useApi(() => getRenewals({ limit: 1000 }));

  const rows = (renewals.data || []).map(decorateRenewal);
  const filtered = responseFilter ? rows.filter((item) => item.customer_response === responseFilter) : rows;
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
          <StatCard key={option} label={option} value={counts[option] ?? 0} variant={option === 'Renewed' ? 'green' : option === 'Rejected' ? 'red' : option === 'No Response' ? 'amber' : 'accent'} onClick={() => setResponseFilter(option)} />
        ))}
      </div>

      <div className="content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{filtered.length} Renewal Records</div>
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
            <RenewalTable renewals={filtered} onUpdated={() => { stats.reload(); renewals.reload(); }} />
          )}
        </div>
      </div>
    </>
  );
}
