import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteRenewalDump, getRenewalDumps, getRenewalStats } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { fmtDate } from '../lib/utils.js';
import { ProgressBar, StatCard, StatusBadge, Loading, ErrorMsg, EmptyState } from '../components/UI.jsx';
import { useToast } from '../components/Toast.jsx';
import NewRenewalDumpModal from '../components/NewRenewalDumpModal.jsx';
import RenewalExportModal from '../components/RenewalExportModal.jsx';

export default function RenewalDumps() {
  const navigate = useNavigate();
  const toast = useToast();
  const role = localStorage.getItem('role');
  const isViewer = role === 'viewer';
  const [showNew, setShowNew] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const stats = useApi(() => getRenewalStats());
  const dumps = useApi(() => getRenewalDumps(), []);

  const filtered = (dumps.data || []).filter((dump) => {
    const term = search.toLowerCase();
    const matchesSearch = !search || dump.company.toLowerCase().includes(term) || dump.id.toLowerCase().includes(term);
    const matchesStatus = !statusFilter || dump.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleReload = async () => {
    await Promise.all([stats.reload(), dumps.reload()]);
  };

  const handleDelete = async (dumpId) => {
    if (!window.confirm(`Delete renewal dump ${dumpId}? All renewal records inside it will also be deleted.`)) return;
    try {
      await deleteRenewalDump(dumpId);
      toast(`Renewal dump ${dumpId} deleted`);
      await handleReload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const s = stats.data || {};

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Renewal Dumps</div>
          <div className="page-desc">Upload and track renewal-specific policy dump batches</div>
        </div>
        <div className="header-actions">
          <button className="btn primary" onClick={() => setShowNew(true)} disabled={isViewer}>+ Upload Renewal Dump</button>
          <button className="btn" onClick={() => setShowExport(true)} disabled={isViewer}>Export</button>
        </div>
      </div>

      <div className="stats-bar" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <StatCard label="Total Dumps" value={s.totalDumps ?? '–'} variant="accent" />
        <StatCard label="Total Renewals" value={s.totalRenewals ?? '–'} />
        <StatCard label="Due Soon" value={s.dueSoon ?? '–'} variant="amber" />
        <StatCard label="Expired" value={s.expired ?? '–'} variant="red" />
        <StatCard label="Renewed" value={s.renewed ?? '–'} variant="green" />
      </div>

      <div className="content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Renewal Dump Registry</div>
            <div className="filter-bar">
              <input className="search-input" placeholder="Search dump/company…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
              ? <EmptyState text="No renewal dumps found" hint="Upload a renewal workbook to get started" />
              : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Dump ID</th>
                        <th>Company</th>
                        <th>Upload Date</th>
                        <th>Total</th>
                        <th>Due Soon</th>
                        <th>Expired</th>
                        <th>Deleted</th>
                        <th>Status</th>
                        <th>Renewal Progress</th>
                        {!isViewer && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((dump) => (
                        <tr key={dump.id} className="clickable" onClick={() => navigate(`/renewal-dumps/${dump.id}`)}>
                          <td className="mono">{dump.id}</td>
                          <td><strong>{dump.company}</strong></td>
                          <td>{fmtDate(dump.upload_date)}</td>
                          <td className="mono">{dump.total_renewals}</td>
                          <td className="mono">{dump.due_soon_count}</td>
                          <td className="mono">{dump.expired_count}</td>
                          <td className="mono">{dump.deleted_renewals ?? 0}</td>
                          <td><StatusBadge status={dump.status} /></td>
                          <td style={{ minWidth: 180 }}>
                            <ProgressBar resolved={dump.renewed_count} total={dump.total_renewals} />
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                              {dump.renewed_count}/{dump.total_renewals} renewed
                            </div>
                          </td>
                          {!isViewer && (
                            <td onClick={(e) => e.stopPropagation()}>
                              <button className="btn sm danger" onClick={() => handleDelete(dump.id)}>Delete</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )}
        </div>
      </div>

      {showNew && <NewRenewalDumpModal onClose={() => setShowNew(false)} onCreated={handleReload} />}
      {showExport && <RenewalExportModal dumps={dumps.data || []} onClose={() => setShowExport(false)} />}
    </>
  );
}
