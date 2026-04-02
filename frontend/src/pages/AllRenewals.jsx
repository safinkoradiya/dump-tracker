import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getRenewalStats, getRenewals } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { CUSTOMER_RESPONSE_OPTIONS, RENEWAL_STATUS_OPTIONS } from '../lib/renewalUtils.js';
import { Loading, ErrorMsg, StatCard, Pagination } from '../components/UI.jsx';
import RenewalTable from '../components/RenewalTable.jsx';

const PAGE_SIZE = 50;

function RenewalListPage({ title, desc, mode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [rm, setRm] = useState(searchParams.get('rm') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [insurer, setInsurer] = useState(searchParams.get('insurer') || '');
  const [customerResponse, setCustomerResponse] = useState(searchParams.get('customerResponse') || '');
  const page = Math.max(Number(searchParams.get('page') || 1), 1);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setRm(searchParams.get('rm') || '');
    setStatus(searchParams.get('status') || '');
    setInsurer(searchParams.get('insurer') || '');
    setCustomerResponse(searchParams.get('customerResponse') || '');
  }, [searchParams]);

  const updateFilters = (next, { preservePage = false } = {}) => {
    const merged = {
      search,
      rm,
      status,
      insurer,
      customerResponse,
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

  const res = useApi(() => getRenewals({
    ...(mode !== 'all' ? { mode } : {}),
    ...(rm ? { rm_name: rm } : {}),
    ...(status ? { status } : {}),
    ...(insurer ? { insurer } : {}),
    ...(customerResponse ? { customer_response: customerResponse } : {}),
    ...(search ? { search } : {}),
    page,
    limit: PAGE_SIZE,
  }), [mode, rm, status, insurer, customerResponse, search, page]);
  const stats = useApi(() => getRenewalStats());

  const renewals = res.data || [];
  const rms = res.response?.meta?.rms || [];
  const insurers = res.response?.meta?.insurers || [];
  const total = res.response?.total ?? renewals.length;
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
            <div className="card-title">{total} {title}</div>
            <div className="filter-bar">
              <input className="search-input" placeholder="Search policy / customer / vehicle…" value={search} onChange={(e) => updateFilters({ search: e.target.value })} />
              <select className="filter-select" value={rm} onChange={(e) => updateFilters({ rm: e.target.value })}>
                <option value="">All RMs</option>
                {rms.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select className="filter-select" value={status} onChange={(e) => updateFilters({ status: e.target.value })}>
                <option value="">All Status</option>
                {RENEWAL_STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select className="filter-select" value={insurer} onChange={(e) => updateFilters({ insurer: e.target.value })}>
                <option value="">All Insurers</option>
                {insurers.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select className="filter-select" value={customerResponse} onChange={(e) => updateFilters({ customerResponse: e.target.value })}>
                <option value="">All Customer Responses</option>
                {CUSTOMER_RESPONSE_OPTIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
          {res.loading ? <Loading /> : res.error ? <ErrorMsg msg={res.error} /> : (
            <>
              <RenewalTable renewals={renewals} onUpdated={() => { res.reload(); stats.reload(); }} />
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
