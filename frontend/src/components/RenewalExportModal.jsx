import { useState } from 'react';
import { exportRenewalExcel } from '../lib/api.js';
import { useToast } from './Toast.jsx';

const BASIC_FIELDS = [
  'renewal_dump_id', 'sheet_name', 'policy_number', 'original_policy_number',
  'policy_holder_name', 'vehicle_number', 'insurer', 'rm_name',
  'policy_valid_till', 'status', 'customer_response',
];

const EXTRA_FIELDS = [
  'source_rm', 'latest_rm', 'source_partner', 'vehicle_make', 'vehicle_model',
  'vehicle_variant', 'policy_type', 'vehicle_class', 'policy_valid_from',
  'od_end_date', 'tp_end_date', 'inwarding_date', 'net_premium',
  'total_premium_amount', 'pending_with', 'next_follow_up_date',
  'quoted_premium', 'renewed_premium', 'renewed_insurer', 'renewed_on', 'remarks',
];

export default function RenewalExportModal({ dumps = [], onClose }) {
  const toast = useToast();
  const [selectedFields, setSelectedFields] = useState(BASIC_FIELDS);
  const [selectedDumps, setSelectedDumps] = useState([]);

  const toggle = (value, current, setCurrent) => {
    setCurrent((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]);
  };

  const handleExport = async () => {
    try {
      const blob = await exportRenewalExcel({ fields: selectedFields, dumpIds: selectedDumps });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'renewals-export.xlsx';
      a.click();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="modal-header">
          <div className="modal-title">Export Renewal Data</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="detail-section">
            <div className="detail-section-title">Basic Fields</div>
            <div className="form-grid">
              {BASIC_FIELDS.map((field) => (
                <label key={field} className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={selectedFields.includes(field)} onChange={() => toggle(field, selectedFields, setSelectedFields)} />
                  {field}
                </label>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-title">Extra Fields</div>
            <div className="form-grid">
              {EXTRA_FIELDS.map((field) => (
                <label key={field} className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={selectedFields.includes(field)} onChange={() => toggle(field, selectedFields, setSelectedFields)} />
                  {field}
                </label>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-title">Renewal Dumps</div>
            <div className="form-grid">
              {dumps.map((dump) => (
                <label key={dump.id} className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={selectedDumps.includes(dump.id)} onChange={() => toggle(dump.id, selectedDumps, setSelectedDumps)} />
                  {dump.id} — {dump.company}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleExport}>Export Renewal Excel</button>
        </div>
      </div>
    </div>
  );
}
