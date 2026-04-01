import { useState } from 'react';
import { deleteRenewal, updateRenewal } from '../lib/api.js';
import { CUSTOMER_RESPONSE_OPTIONS, RENEWAL_BUCKET_LABELS, RENEWAL_STATUS_OPTIONS, decorateRenewal, renewalBucketClass, renewalDaysLabel, renewalStatusClass } from '../lib/renewalUtils.js';
import { fmtDate } from '../lib/utils.js';
import { useToast } from './Toast.jsx';
import { canManageData } from '../lib/access.js';

export default function RenewalModal({ renewal, onClose, onSaved, onDeleted }) {
  const toast = useToast();
  const canEdit = canManageData();
  const record = decorateRenewal(renewal);
  const [form, setForm] = useState({
    rm_name: record.rm_name || '',
    status: record.status || 'Pending',
    customer_response: record.customer_response || 'No Response',
    pending_with: record.pending_with || '',
    next_follow_up_date: record.next_follow_up_date ? record.next_follow_up_date.slice(0, 10) : '',
    quoted_premium: record.quoted_premium || '',
    renewed_premium: record.renewed_premium || '',
    renewed_insurer: record.renewed_insurer || '',
    renewed_on: record.renewed_on ? record.renewed_on.slice(0, 10) : '',
    remarks: record.remarks || '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateRenewal(record.id, form);
      toast('Renewal updated');
      onSaved(updated.data);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete renewal ${record.policy_number || record.vehicle_number}?`)) return;
    setDeleting(true);
    try {
      await deleteRenewal(record.id);
      toast('Renewal deleted');
      if (onDeleted) onDeleted(record.id);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="modal-header">
          <div className="modal-title">Renewal: <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{record.policy_number || record.vehicle_number}</span></div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="detail-section">
            <div className="detail-section-title">Policy Info</div>
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-key">Dump ID</div>
                <div className="detail-val" style={{ color: 'var(--accent)' }}>{record.renewal_dump_id}</div>
              </div>
              <div className="detail-item">
                <div className="detail-key">Sheet</div>
                <div className="detail-val">{record.sheet_name || '–'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-key">Customer</div>
                <div className="detail-val">{record.policy_holder_name || '–'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-key">Vehicle</div>
                <div className="detail-val mono">{record.vehicle_number || '–'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-key">Insurer</div>
                <div className="detail-val">{record.insurer || '–'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-key">Policy Valid Till</div>
                <div className="detail-val">{fmtDate(record.policy_valid_till)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-key">Days To Renewal</div>
                <div className="detail-val">{renewalDaysLabel(record.days_to_renewal)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-key">Bucket</div>
                <div className="detail-val">
                  <span className={`badge ${renewalBucketClass(record.bucket)}`}>{RENEWAL_BUCKET_LABELS[record.bucket] || 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-title">Tracking</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Assigned RM</label>
                <input disabled={!canEdit} className="form-control" value={form.rm_name} onChange={(e) => set('rm_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select disabled={!canEdit} className="form-control" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {RENEWAL_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Customer Response</label>
                <select disabled={!canEdit} className="form-control" value={form.customer_response} onChange={(e) => set('customer_response', e.target.value)}>
                  {CUSTOMER_RESPONSE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Pending With</label>
                <input disabled={!canEdit} className="form-control" value={form.pending_with} onChange={(e) => set('pending_with', e.target.value)} placeholder="RM / Customer / Insurer…" />
              </div>
              <div className="form-group">
                <label className="form-label">Next Follow-up</label>
                <input disabled={!canEdit} className="form-control" type="date" value={form.next_follow_up_date} onChange={(e) => set('next_follow_up_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Quoted Premium</label>
                <input disabled={!canEdit} className="form-control" value={form.quoted_premium} onChange={(e) => set('quoted_premium', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Renewed Premium</label>
                <input disabled={!canEdit} className="form-control" value={form.renewed_premium} onChange={(e) => set('renewed_premium', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Renewed Insurer</label>
                <input disabled={!canEdit} className="form-control" value={form.renewed_insurer} onChange={(e) => set('renewed_insurer', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Renewed On</label>
                <input disabled={!canEdit} className="form-control" type="date" value={form.renewed_on} onChange={(e) => set('renewed_on', e.target.value)} />
              </div>
              <div className="form-group full">
                <label className="form-label">Remarks</label>
                <textarea disabled={!canEdit} className="form-control" rows={3} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="status-row">
            <span>Renewal Status</span>
            <span className={`badge ${renewalStatusClass(form.status)}`}>{form.status}</span>
          </div>
        </div>

        <div className="modal-footer">
          {canEdit && (
            <button className="btn danger" onClick={remove} disabled={saving || deleting}>
              {deleting ? 'Deleting…' : 'Delete Renewal'}
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={saving || deleting || !canEdit}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
