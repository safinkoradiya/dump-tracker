import { useState, useCallback } from 'react';
import { getPolicies, getStats } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { StatCard, Loading, ErrorMsg } from '../components/UI.jsx';
import PoliciesTable from '../components/PoliciesTable.jsx';

function PoliciesPage({ title, desc, statusFixed, extraFilters, statsVariant }) {
  const [search, setSearch]   = useState('');
  const [rm, setRm]           = useState('');
  const [status, setStatus]   = useState('');
  const [company, setCompany] = useState('');
  const [bucket, setBucket]   = useState('');
  const [side, setSide]       = useState('');

  const params = {
    ...(statusFixed ? { status: statusFixed } : status ? { status } : {}),
    ...(rm      ? { rm_name: rm }      : {}),
    ...(company ? { company }          : {}),
    ...(search  ? { search }           : {}),
    limit: 500,
  };

  const res   = useApi(() => getPolicies(params), [statusFixed, rm, status, company, search]);
  const stats = useApi(() => getStats());

  const allPolicies = res.data || [];

  // Client-side bucket + side filter (quick, avoids extra API call)
  const filtered = allPolicies.filter(p => {
    if (bucket && p.bucket !== bucket) return false;
    if (side   && (p.pending_side || '').toLowerCase() !== side.toLowerCase()) return false;
    return true;
  });

  const rms       = [...new Set(allPolicies.map(p => p.rm_name).filter(Boolean))].sort();
  const companies = [...new Set(allPolicies.map(p => p.company).filter(Boolean))].sort();

  const handleUpdated = () => res.reload();
  const s = stats.data || {};

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-desc">{desc}</div>
        </div>
      </div>

      <div className="stats-bar">
        <StatCard label="Total Dumps"    value={s.totalDumps    ?? '–'} variant="accent" />
        <StatCard label="Total Policies" value={s.totalPolicies ?? '–'} />
        <StatCard label="Pending"        value={s.pending       ?? '–'} variant="amber" />
        <StatCard label="Resolved"       value={s.resolved      ?? '–'} sub={s.resolutionPct ? `${s.resolutionPct}%` : ''} variant="green" />
      </div>

      <div className="content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{filtered.length} {title}</div>
            <div className="filter-bar">
              <input className="search-input" placeholder="Search policy / RM…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="filter-select" value={rm} onChange={e => setRm(e.target.value)}>
                <option value="">All RMs</option>
                {rms.map(r => <option key={r}>{r}</option>)}
              </select>
              {!statusFixed && (
                <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option>Pending</option>
                  <option>Resolved</option>
                </select>
              )}
              <select className="filter-select" value={company} onChange={e => setCompany(e.target.value)}>
                <option value="">All Companies</option>
                {companies.map(c => <option key={c}>{c}</option>)}
              </select>
              {extraFilters && (
                <>
                  <select className="filter-select" value={bucket} onChange={e => setBucket(e.target.value)}>
                    <option value="">All Buckets</option>
                    <option value="hot">&lt; 3 Days</option>
                    <option value="warm">3–15 Days</option>
                    <option value="cold">&gt; 15 Days</option>
                  </select>
                  <select className="filter-select" value={side} onChange={e => setSide(e.target.value)}>
                    <option value="">All — Pending With</option>
                    <option>RM</option>
                    <option>Company</option>
                    <option>Customer</option>
                    <option>IMD</option>
                  </select>
                </>
              )}
            </div>
          </div>
          {res.loading ? <Loading /> : res.error ? <ErrorMsg msg={res.error} /> : (
            <PoliciesTable policies={filtered} onUpdated={handleUpdated} />
          )}
        </div>
      </div>
    </>
  );
}

export function AllPolicies() {
  return <PoliciesPage title="All Policies" desc="Complete list of all policies across all dumps" />;
}

export function PendingPolicies() {
  return <PoliciesPage title="Pending Policies" desc="Policies awaiting RM and/or company resolution" statusFixed="Pending" extraFilters />;
}

export function ResolvedPolicies() {
  return <PoliciesPage title="Resolved Policies" desc="Policies where both RM and company confirmed resolution" statusFixed="Resolved" />;
}

export default AllPolicies;