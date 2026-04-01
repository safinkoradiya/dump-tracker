import { useState } from 'react';
import { getRenewalStats, getRenewals } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { CUSTOMER_RESPONSE_OPTIONS, RENEWAL_STATUS_OPTIONS, decorateRenewal } from '../lib/renewalUtils.js';
import { Loading, ErrorMsg, StatCard } from '../components/UI.jsx';
import RenewalTable from '../components/RenewalTable.jsx';

function RenewalListPage({ title, desc, mode }) {
  const [search, setSearch] = useState('');
  const [rm, setRm] = useState('');
  const [status, setStatus] = useState('');
  const [insurer, setInsurer] = useState('');
  const [customerResponse, setCustomerResponse] = useState('');

  const res = useApi(() => getRenewals({
    ...(rm ? { rm_name: rm } : {}),
    ...(status ? { status } : {}),
    ...(insurer ? { insurer } : {}),
    ...(customerResponse ? { customer_response: customerResponse } : {}),
    ...(search ? { search } : {}),
    limit: 1000,
  }), [rm, status, insurer, customerResponse, search]);
  const stats = useApi(() => getRenewalStats());

  const renewals = (res.data || []).map(decorateRenewal);
  const filtered = renewals.filter((renewal) => {
    if (mode === 'dueSoon') return renewal.is_due_soon;
    if (mode === 'expired') return renewal.is_expired;
    return true;
  });

  const rms = [...new Set(renewals.map((item) => item.rm_name).filter(Boolean))].sort();
  const insurers = [...new Set(renewals.map((item) => item.insurer).filter(Boolean))].sort();
  const s = stats.data || {};

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-desc">{desc}</div>
        </div>
      </div>

      <div className="stats-bar" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <StatCard label="Total Renewals" value={s.totalRenewals ?? '–'} variant="accent" />
        <StatCard label="Due Soon" value={s.dueSoon ?? '–'} variant="amber" />
        <StatCard label="Expired" value={s.expired ?? '–'} variant="red" />
        <StatCard label="Renewed" value={s.renewed ?? '–'} variant="green" />
        <StatCard label="No Response" value={s.noResponse ?? '–'} />
      </div>

      <div className="content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{filtered.length} {title}</div>
            <div className="filter-bar">
              <input className="search-input" placeholder="Search policy / customer / vehicle…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="filter-select" value={rm} onChange={(e) => setRm(e.target.value)}>
                <option value="">All RMs</option>
                {rms.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All Status</option>
                {RENEWAL_STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select className="filter-select" value={insurer} onChange={(e) => setInsurer(e.target.value)}>
                <option value="">All Insurers</option>
                {insurers.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select className="filter-select" value={customerResponse} onChange={(e) => setCustomerResponse(e.target.value)}>
                <option value="">All Customer Responses</option>
                {CUSTOMER_RESPONSE_OPTIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
          {res.loading ? <Loading /> : res.error ? <ErrorMsg msg={res.error} /> : (
            <RenewalTable renewals={filtered} onUpdated={() => { res.reload(); stats.reload(); }} />
          )}
        </div>
      </div>
    </>
  );
}

export function AllRenewals() {
  return <RenewalListPage title="All Renewals" desc="All active renewal opportunities across uploaded renewal dumps" mode="all" />;
}

export function DueSoonRenewals() {
  return <RenewalListPage title="Due Soon" desc="Policies coming up for renewal in the next 30 days" mode="dueSoon" />;
}

export function ExpiredRenewals() {
  return <RenewalListPage title="Expired" desc="Policies past their validity date and still not renewed" mode="expired" />;
}

export default AllRenewals;
