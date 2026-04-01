import { useState } from 'react';
import { fmtDate, daysPending } from '../lib/utils.js';
import { StatusBadge, BucketBadge, DaysBadge, CheckBadge, EmptyState } from './UI.jsx';
import PolicyModal from './PolicyModal.jsx';

export default function PoliciesTable({ policies = [], onUpdated }) {
  const [selected, setSelected] = useState(null);
  const role = localStorage.getItem("role");
  const isViewer = role === "viewer";

  const handleSaved = (updated) => {
    if (onUpdated) onUpdated(updated);
  };

  const handleDeleted = () => {
    setSelected(null);
    if (onUpdated) onUpdated();
  };

  if (!policies.length) return <EmptyState text="No policies found" hint="Adjust filters or upload a dump" />;

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Policy No.</th>
              <th>Dump ID</th>
              <th>RM / Login ID</th>
              <th>IMD Name</th>
              <th>Recv. Date</th>
              <th>Days Pending</th>
              <th>Bucket</th>
              <th>Pending With</th>
              <th>QC Remarks</th>
              <th>RM ✓</th>
              <th>Co. ✓</th>
              <th>Status</th>
              {!isViewer && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {policies.map(p => {
              const days = p.days_pending ?? daysPending(p.recv_date, p.rm_resolved, p.company_resolved);
              const status = (p.rm_resolved && p.company_resolved) ? 'Resolved' : 'Pending';
              return (
                <tr key={p.id} className="clickable" onClick={() => setSelected(p)}>
                  <td className="mono">{p.policy_no}</td>
                  <td className="mono" style={{ color: 'var(--accent)' }}>{p.dump_id}</td>
                  <td>{p.rm_name || '–'}</td>
                  <td>{p.imd_name || '–'}</td>
                  <td>{fmtDate(p.recv_date)}</td>
                  <td><DaysBadge days={days} /></td>
                  <td><BucketBadge days={days} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{p.pending_side || '–'}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }} title={p.rm_response}>
                    {p.rm_response ? p.rm_response.slice(0, 40) + (p.rm_response.length > 40 ? '…' : '') : '–'}
                  </td>
                  <td><CheckBadge value={p.rm_resolved} /></td>
                  <td><CheckBadge value={p.company_resolved} /></td>
                  <td><StatusBadge status={status} /></td>
                  {!isViewer && (
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn sm danger" onClick={() => setSelected(p)}>
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

      {selected && (
        <PolicyModal
          policy={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
