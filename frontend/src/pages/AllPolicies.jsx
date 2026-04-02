import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPolicies, getStats } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { StatCard, Loading, ErrorMsg, Pagination } from '../components/UI.jsx';
import PoliciesTable from '../components/PoliciesTable.jsx';

const PAGE_SIZE = 50;

function PoliciesPage({ title, desc, statusFixed, extraFilters }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [rm, setRm] = useState(searchParams.get('rm') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [company, setCompany] = useState(searchParams.get('company') || '');
  const [bucket, setBucket] = useState(searchParams.get('bucket') || '');
  const [side, setSide] = useState(searchParams.get('side') || '');
  const page = Math.max(Number(searchParams.get('page') || 1), 1);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setRm(searchParams.get('rm') || '');
    setStatus(searchParams.get('status') || '');
    setCompany(searchParams.get('company') || '');
    setBucket(searchParams.get('bucket') || '');
    setSide(searchParams.get('side') || '');
  }, [searchParams]);

  const updateFilters = (next, { preservePage = false } = {}) => {
    const merged = {
      search,
      rm,
      status,
      company,
      bucket,
      side,
      page: String(page),
      ...next,
    };

    if (!preservePage) merged.page = '1';

    const params = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value && !(key === 'page' && value === '1')) params.set(key, value);
    });
    setSearchParams(params, { replace: true });
  };

  const params = {
    ...(statusFixed ? { status: statusFixed } : status ? { status } : {}),
    ...(rm ? { rm_name: rm } : {}),
    ...(company ? { company } : {}),
    ...(search ? { search } : {}),
    ...(bucket ? { bucket } : {}),
    ...(side ? { pending_side: side } : {}),
    page,
    limit: PAGE_SIZE,
  };

  const res = useApi(() => getPolicies(params), [statusFixed, rm, status, company, search, bucket, side, page]);
  const stats = useApi(() => getStats());

  const policies = res.data || [];
  const rms = res.response?.meta?.rms || [];
  const companies = res.response?.meta?.companies || [];
  const total = res.response?.total ?? policies.length;

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
        <StatCard label="Total Dumps" value={s.totalDumps ?? '–'} variant="accent" />
        <StatCard label="Total Policies" value={s.totalPolicies ?? '–'} />
        <StatCard label="Pending" value={s.pending ?? '–'} variant="amber" />
        <StatCard label="Resolved" value={s.resolved ?? '–'} sub={s.resolutionPct ? `${s.resolutionPct}%` : ''} variant="green" />
      </div>

      <div className="content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{total} {title}</div>
            <div className="filter-bar">
              <input className="search-input" placeholder="Search policy / RM…" value={search} onChange={(e) => updateFilters({ search: e.target.value })} />
              <select className="filter-select" value={rm} onChange={(e) => updateFilters({ rm: e.target.value })}>
                <option value="">All RMs</option>
                {rms.map((item) => <option key={item}>{item}</option>)}
              </select>
              {!statusFixed && (
                <select className="filter-select" value={status} onChange={(e) => updateFilters({ status: e.target.value })}>
                  <option value="">All Status</option>
                  <option>Pending</option>
                  <option>Resolved</option>
                </select>
              )}
              <select className="filter-select" value={company} onChange={(e) => updateFilters({ company: e.target.value })}>
                <option value="">All Companies</option>
                {companies.map((item) => <option key={item}>{item}</option>)}
              </select>
              {extraFilters && (
                <>
                  <select className="filter-select" value={bucket} onChange={(e) => updateFilters({ bucket: e.target.value })}>
                    <option value="">All Buckets</option>
                    <option value="hot">&lt; 3 Days</option>
                    <option value="warm">3–15 Days</option>
                    <option value="cold">&gt; 15 Days</option>
                  </select>
                  <select className="filter-select" value={side} onChange={(e) => updateFilters({ side: e.target.value })}>
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
            <>
              <PoliciesTable policies={policies} onUpdated={handleUpdated} />
              <Pagination
                page={page}
                limit={PAGE_SIZE}
                total={total}
                onPageChange={(nextPage) => updateFilters({ page: String(nextPage) }, { preservePage: true })}
              />
            </>
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
