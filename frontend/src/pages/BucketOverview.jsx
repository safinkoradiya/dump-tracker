import { useState } from 'react';
import { getPolicies, getBuckets } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { StatCard, Loading, ErrorMsg } from '../components/UI.jsx';
import PoliciesTable from '../components/PoliciesTable.jsx';

export default function BucketOverview() {
  const buckets = useApi(() => getBuckets());
  const res     = useApi(() => getPolicies({ status: 'Pending', limit: 500 }));

  const policies = res.data || [];
  const hot  = policies.filter(p => p.bucket === 'hot');
  const warm = policies.filter(p => p.bucket === 'warm');
  const cold = policies.filter(p => p.bucket === 'cold');

  const b = buckets.data || {};

  const handleUpdated = () => { res.reload(); buckets.reload(); };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Bucket Overview</div>
          <div className="page-desc">Pending policies grouped by how long they've been open</div>
        </div>
      </div>

      <div className="stats-bar three">
        <StatCard label="< 3 Days — Fresh"      value={b.hot  ?? '–'} sub="Act soon"        variant="green" />
        <StatCard label="3–15 Days — Follow up" value={b.warm ?? '–'} sub="Needs attention"  variant="accent" />
        <StatCard label="> 15 Days — Overdue"   value={b.cold ?? '–'} sub="Escalate now"    variant="red" />
      </div>

      {res.loading || buckets.loading ? <Loading /> : (
        <div className="content">
          <div className="card bucket-section">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge hot">&lt; 3 Days</span> Fresh Policies
              </div>
            </div>
            <PoliciesTable policies={hot} onUpdated={handleUpdated} />
          </div>

          <div className="card bucket-section">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge warm">3–15 Days</span> Needs Follow-up
              </div>
            </div>
            <PoliciesTable policies={warm} onUpdated={handleUpdated} />
          </div>

          <div className="card bucket-section">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge cold">&gt; 15 Days</span> Overdue — Escalate
              </div>
            </div>
            <PoliciesTable policies={cold} onUpdated={handleUpdated} />
          </div>
        </div>
      )}
    </>
  );
}