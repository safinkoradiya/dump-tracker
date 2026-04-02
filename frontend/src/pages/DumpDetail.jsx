import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { deleteDump, getDump, getPolicies, importFile } from '../lib/api.js';
import { fmtDate } from '../lib/utils.js';
import { useApi } from '../hooks/useApi.js';
import { StatCard, ProgressBar, Loading, ErrorMsg, Pagination } from '../components/UI.jsx';
import PoliciesTable from '../components/PoliciesTable.jsx';
import { useToast } from '../components/Toast.jsx';
import { canManageData } from '../lib/access.js';

const PAGE_SIZE = 50;

export default function DumpDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [rmFilter, setRmFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const canEdit = canManageData();

  useEffect(() => {
    setPage(1);
  }, [id, rmFilter, statusFilter]);

  const dump = useApi(() => getDump(id), [id]);
  const polsRes = useApi(() => getPolicies({
    dump_id: id,
    ...(rmFilter ? { rm_name: rmFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    page,
    limit: PAGE_SIZE,
  }), [id, rmFilter, statusFilter, page]);

  const policies = polsRes.data || [];
  const rms = polsRes.response?.meta?.rms || [];
  const totalPoliciesInDump = polsRes.response?.total ?? policies.length;

  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const res = await importFile(id, file);
      toast(`${res.count} policies imported`);
      polsRes.reload();
      dump.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
    e.target.value = '';
  };

  const handleUpdated = () => {
    polsRes.reload();
    dump.reload();
  };

  const handleDeleteDump = async () => {
    if (!window.confirm(`Delete dump ${id}? All active and deleted policies under it will be removed.`)) return;
    try {
      await deleteDump(id);
      toast(`Dump ${id} deleted`);
      navigate('/');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const d = dump.data;
  const total = d?.total_policies ?? totalPoliciesInDump;
  const resolved = d?.resolved_count ?? 0;
  const deleted = d?.deleted_policies ?? 0;

  return (
    <>
      <div className="page-header">
        <div>
          <button className="btn ghost sm" onClick={() => navigate('/')} style={{ marginBottom: 8 }}>← Back to Dumps</button>
          {d ? (
            <>
              <div className="page-title">{d.id} — {d.company}</div>
              <div className="page-desc">Uploaded {fmtDate(d.upload_date)}{d.remarks ? ` · ${d.remarks}` : ''}</div>
            </>
          ) : <div className="page-title">Loading…</div>}
        </div>
        <div className="header-actions">
          <label className="btn" style={!canEdit ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
            Import Excel
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileImport} />
          </label>
          {canEdit && (
            <button className="btn danger" onClick={handleDeleteDump}>
              Delete Dump
            </button>
          )}
        </div>
      </div>

      <div className="stats-bar">
        <StatCard label="Total Policies" value={total} variant="accent" />
        <StatCard label="Resolved" value={resolved} variant="green" />
        <StatCard label="Pending" value={total - resolved} variant="amber" />
        <StatCard label="Deleted Policies" value={deleted} variant="red" />
        <div className="stat-card">
          <div className="stat-label">Progress</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{total > 0 ? Math.round(resolved / total * 100) : 0}%</div>
          <div style={{ marginTop: 6 }}><ProgressBar resolved={resolved} total={total} /></div>
        </div>
      </div>

      <div className="content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{totalPoliciesInDump} Policies in {id}</div>
            <div className="filter-bar">
              <select className="filter-select" value={rmFilter} onChange={(e) => setRmFilter(e.target.value)}>
                <option value="">All RMs</option>
                {rms.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option>Pending</option>
                <option>Resolved</option>
              </select>
            </div>
          </div>
          {polsRes.loading ? <Loading /> : polsRes.error ? <ErrorMsg msg={polsRes.error} /> : (
            <>
              <PoliciesTable policies={policies} onUpdated={handleUpdated} />
              <Pagination page={page} limit={PAGE_SIZE} total={totalPoliciesInDump} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
