import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteDump, getDumps, getStats } from '../lib/api.js';
import { fmtDate, getDumpStatus, progressColor } from '../lib/utils.js';
import { useApi } from '../hooks/useApi.js';
import { StatCard, StatusBadge, ProgressBar, Loading, ErrorMsg, EmptyState } from '../components/UI.jsx';
import NewDumpModal from '../components/NewDumpModal.jsx';
import ExportModal from "../components/ExportModal";
import { useToast } from '../components/Toast.jsx';
import { canManageData } from '../lib/access.js';
 

export default function AllDumps() {
  const navigate = useNavigate();
  const toast = useToast();
  const [showNew, setShowNew] = useState(false);

  // ✅ ADD THIS
  const [showExport, setShowExport] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const stats = useApi(() => getStats());
  const dumps = useApi(() => getDumps(), []);

  const filtered = (dumps.data || []).filter(d => {
    const matchSearch = !search || d.company.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreated = () => dumps.reload();
  const handleDeleteDump = async (dumpId) => {
    if (!window.confirm(`Delete dump ${dumpId}? All policies in it will also be deleted.`)) return;
    try {
      await deleteDump(dumpId);
      toast(`Dump ${dumpId} deleted`);
      await Promise.all([dumps.reload(), stats.reload()]);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const s = stats.data || {};
  const canEdit = canManageData();

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">All Dumps</div>
          <div className="page-desc">Track all uploaded insurance policy dump batches</div>
        </div>
        <div className="header-actions">
          <button
  className="btn primary"
  onClick={() => setShowNew(true)}
  disabled={!canEdit}
  title={!canEdit ? "Read-only access" : ""}
>
  + Upload Dump
</button>
          {/* ✅ ADD THIS BUTTON */}
          <button
  className="btn"
  onClick={() => setShowExport(true)}
  disabled={!canEdit}
  title={!canEdit ? "Read-only access" : ""}
>
  Export
</button>

        </div>
      </div>

      <div className="stats-bar">
        <StatCard label="Total Dumps"    value={s.totalDumps    ?? '–'} variant="accent" />
        <StatCard label="Total Policies" value={s.totalPolicies ?? '–'} />
        <StatCard label="Pending"        value={s.pending       ?? '–'} variant="amber" />
        <StatCard label="Resolved"       value={s.resolved      ?? '–'} sub={s.totalPolicies ? `${s.resolutionPct}% rate` : ''} variant="green" />
      </div>

      <div className="content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Dump Registry</div>
            <div className="filter-bar">
              <input className="search-input" placeholder="Search company…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option>Pending</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>
            </div>
          </div>

          {dumps.loading && <Loading />}
          {dumps.error && <ErrorMsg msg={dumps.error} />}
          {!dumps.loading && !dumps.error && (
            filtered.length === 0
              ? <EmptyState text="No dumps found" hint="Upload a dump to get started" />
              : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Dump ID</th>
                        <th>Company</th>
                        <th>Upload Date</th>
                        <th>Total Policies</th>
                        <th>Deleted Policies</th>
                        <th>Status</th>
                        <th>Progress</th>
                        {canEdit && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(d => {
                        const pct = d.total_policies > 0 ? Math.round(d.resolved_count / d.total_policies * 100) : 0;
                        return (
                          <tr key={d.id} className="clickable" onClick={() => navigate(`/dumps/${d.id}`)}>
                            <td className="mono">{d.id}</td>
                            <td><strong>{d.company}</strong></td>
                            <td>{fmtDate(d.upload_date)}</td>
                            <td className="mono">{d.total_policies}</td>
                            <td className="mono">{d.deleted_policies ?? 0}</td>
                            <td><StatusBadge status={d.status} /></td>
                            <td style={{ minWidth: 180 }}>
                              <ProgressBar resolved={d.resolved_count} total={d.total_policies} />
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                                {d.resolved_count}/{d.total_policies} resolved
                              </div>
                            </td>
                            {canEdit && (
                              <td onClick={e => e.stopPropagation()}>
                                <button className="btn sm danger" onClick={() => handleDeleteDump(d.id)}>
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
          )}
        </div>
      </div>

      {showNew && <NewDumpModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}

      {/* ✅ ADD THIS MODAL */}
      {showExport && (
        <ExportModal
          dumps={dumps.data || []}
          onClose={() => setShowExport(false)}
        />
      )}
    </>
  );
}
