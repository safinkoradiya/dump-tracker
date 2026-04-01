import { useState } from 'react';
import { decorateRenewal, RENEWAL_BUCKET_LABELS, renewalBucketClass, renewalDaysLabel, renewalStatusClass } from '../lib/renewalUtils.js';
import { fmtDate } from '../lib/utils.js';
import { EmptyState } from './UI.jsx';
import RenewalModal from './RenewalModal.jsx';

export default function RenewalTable({ renewals = [], onUpdated }) {
  const [selected, setSelected] = useState(null);
  const role = localStorage.getItem('role');
  const isViewer = role === 'viewer';

  if (!renewals.length) return <EmptyState text="No renewals found" hint="Upload a renewal dump to populate this view" />;

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Policy No.</th>
              <th>Vehicle No.</th>
              <th>Customer</th>
              <th>Insurer</th>
              <th>RM</th>
              <th>Valid Till</th>
              <th>Days</th>
              <th>Bucket</th>
              <th>Status</th>
              <th>Customer</th>
              {!isViewer && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {renewals.map((item) => {
              const renewal = decorateRenewal(item);
              return (
                <tr key={renewal.id} className="clickable" onClick={() => setSelected(renewal)}>
                  <td className="mono">{renewal.policy_number || '–'}</td>
                  <td className="mono">{renewal.vehicle_number || '–'}</td>
                  <td>{renewal.policy_holder_name || '–'}</td>
                  <td>{renewal.insurer || '–'}</td>
                  <td>{renewal.rm_name || '–'}</td>
                  <td>{fmtDate(renewal.policy_valid_till)}</td>
                  <td>{renewalDaysLabel(renewal.days_to_renewal)}</td>
                  <td><span className={`badge ${renewalBucketClass(renewal.bucket)}`}>{RENEWAL_BUCKET_LABELS[renewal.bucket] || 'Unknown'}</span></td>
                  <td><span className={`badge ${renewalStatusClass(renewal.status)}`}>{renewal.status}</span></td>
                  <td>{renewal.customer_response || 'No Response'}</td>
                  {!isViewer && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn sm danger" onClick={() => setSelected(renewal)}>Delete</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <RenewalModal
          renewal={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            if (onUpdated) onUpdated();
          }}
          onDeleted={() => {
            setSelected(null);
            if (onUpdated) onUpdated();
          }}
        />
      )}
    </>
  );
}
