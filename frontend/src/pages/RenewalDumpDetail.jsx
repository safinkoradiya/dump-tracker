import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteRenewalDump, getRenewalDump, getRenewals, importRenewalFile } from '../lib/api.js';
import { fmtDate } from '../lib/utils.js';
import { useApi } from '../hooks/useApi.js';
import { Loading, ErrorMsg, StatCard, Pagination } from '../components/UI.jsx';
import { useToast } from '../components/Toast.jsx';
import RenewalTable from '../components/RenewalTable.jsx';
import { canManageData } from '../lib/access.js';

const PAGE_SIZE = 50;

export default function RenewalDumpDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const canEdit = canManageData();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [id]);

  const dump = useApi(() => getRenewalDump(id), [id]);
  const renewals = useApi(() => getRenewals({ renewal_dump_id: id, page, limit: PAGE_SIZE }), [id, page]);

  const reload = () => {
    renewals.reload();
    dump.reload();
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const result = await importRenewalFile(id, file);
      toast(`${result.count} renewal records imported`);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
    event.target.value = '';
  };

  const handleDeleteDump = async () => {
    if (!window.confirm(`Delete renewal dump ${id}? All its renewal records will also be deleted.`)) return;
    try {
      await deleteRenewalDump(id);
      toast(`Renewal dump ${id} deleted`);
      navigate('/renewal-dumps');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const d = dump.data;
  const totalRenewals = renewals.response?.total ?? d?.total_renewals ?? 0;

  return (
    <>
      <div className="page-header">
        <div>
          <button className="btn ghost sm" onClick={() => navigate('/renewal-dumps')} style={{ marginBottom: 8 }}>← Back to Renewal Dumps</button>
          {d ? (
            <>
              <div className="page-title">{d.id} — {d.company}</div>
              <div className="page-desc">Uploaded {fmtDate(d.upload_date)}{d.remarks ? ` · ${d.remarks}` : ''}</div>
            </>
          ) : <div className="page-title">Loading…</div>}
        </div>
        <div className="header-actions">
          {canEdit && (
            <label className="btn">
              Import Renewal File
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
            </label>
          )}
          {canEdit && <button className="btn danger" onClick={handleDeleteDump}>Delete Dump</button>}
        </div>
      </div>

      <div className="stats-bar" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <StatCard label="Total Renewals" value={d?.total_renewals ?? '–'} variant="accent" />
        <StatCard label="Due Soon" value={d?.due_soon_count ?? '–'} variant="amber" />
        <StatCard label="Expired" value={d?.expired_count ?? '–'} variant="red" />
        <StatCard label="Renewed" value={d?.renewed_count ?? '–'} variant="green" />
        <StatCard label="Deleted Records" value={d?.deleted_renewals ?? '–'} />
      </div>

      <div className="content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{totalRenewals} Renewals in {id}</div>
          </div>
          {renewals.loading ? <Loading /> : renewals.error ? <ErrorMsg msg={renewals.error} /> : (
            <>
              <RenewalTable renewals={renewals.data || []} onUpdated={reload} />
              <Pagination page={page} limit={PAGE_SIZE} total={totalRenewals} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
