import { useState } from 'react';
import { updatePolicy, deletePolicy } from '../lib/api.js';
import { fmtDate, daysPending } from '../lib/utils.js';
import { DaysBadge, BucketBadge } from './UI.jsx';
import { useToast } from './Toast.jsx';
import { canManageData } from '../lib/access.js';

export default function PolicyModal({ policy, onClose, onSaved, onDeleted }) {
  const toast = useToast();
  const canEdit = canManageData();
  const [form, setForm] = useState({
    rm_name:          policy.rm_name || '',
    imd_name:         policy.imd_name || '',
    recv_date:        policy.recv_date ? policy.recv_date.slice(0, 10) : '',
    given_date:       policy.given_date ? policy.given_date.slice(0, 10) : '',
    rm_response:      policy.rm_response || '',
    rm_resolved:      policy.rm_resolved ?? false,
    company_resolved: policy.company_resolved ?? false,
    remarks:          policy.remarks || '',
    pending_side:     policy.pending_side || '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updatePolicy(policy.id, form);
      toast('Policy updated');
      onSaved(updated.data);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete policy ${policy.policy_no}? This will hide it from active dump tracking.`)) return;
    setDeleting(true);
    try {
      await deletePolicy(policy.id);
      toast('Policy deleted');
      if (onDeleted) onDeleted(policy.id);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const days = daysPending(form.recv_date, form.rm_resolved, form.company_resolved);
  const extra = policy.extra || {};

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="modal-header">
          <div className="modal-title">Policy: <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{policy.policy_no}</span></div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Read-only info */}
          <div className="detail-section">
            <div className="detail-section-title">Policy Info</div>
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-key">Dump ID</div>
                <div className="detail-val" style={{ color: 'var(--accent)' }}>{policy.dump_id} {policy.company ? `— ${policy.company}` : ''}</div>
              </div>
              {extra.customerName && (
                <div className="detail-item">
                  <div className="detail-key">Customer</div>
                  <div className="detail-val">{extra.customerName}</div>
                </div>
              )}
              {extra.regNo && (
                <div className="detail-item">
                  <div className="detail-key">Reg. Number</div>
                  <div className="detail-val mono">{extra.regNo}</div>
                </div>
              )}
              {extra.branch && (
                <div className="detail-item">
                  <div className="detail-key">Branch</div>
                  <div className="detail-val">{extra.branch}</div>
                </div>
              )}
              {extra.product && (
                <div className="detail-item full">
                  <div className="detail-key">Product</div>
                  <div className="detail-val">{extra.product}</div>
                </div>
              )}
              {extra.policyStatus && (
                <div className="detail-item">
                  <div className="detail-key">Policy Status</div>
                  <div className="detail-val">{extra.policyStatus}</div>
                </div>
              )}
              {extra.premium && (
                <div className="detail-item">
                  <div className="detail-key">Final Premium</div>
                  <div className="detail-val">₹{Number(extra.premium).toLocaleString('en-IN')}</div>
                </div>
              )}
            </div>
          </div>

          {/* Editable fields */}
          <div className="detail-section">
            <div className="detail-section-title">Edit Resolution</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">RM Name</label>
                <input disabled={!canEdit} className="form-control" value={form.rm_name} onChange={e => set('rm_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">IMD Name</label>
                <input disabled={!canEdit} className="form-control" value={form.imd_name} onChange={e => set('imd_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Recv. Date (IMD)</label>
                <input disabled={!canEdit} className="form-control" type="date" value={form.recv_date} onChange={e => set('recv_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Date Given to RM</label>
                <input disabled={!canEdit} className="form-control" type="date" value={form.given_date} onChange={e => set('given_date', e.target.value)} />
              </div>
              <div className="form-group full">
                <label className="form-label">RM Response / QC Remarks</label>
                <textarea disabled={!canEdit} className="form-control" rows={3} value={form.rm_response} onChange={e => set('rm_response', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Pending With <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(manual)</span></label>
                <input disabled={!canEdit} className="form-control" placeholder="e.g. RM, Company, Customer, IMD…" value={form.pending_side} onChange={e => set('pending_side', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Days Pending</label>
                <div className="form-control" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)' }}>
                  <DaysBadge days={days} />
                  <BucketBadge days={days} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>auto-calculated</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">RM Resolved</label>
                <select disabled={!canEdit} className="form-control" value={form.rm_resolved ? '1' : '0'} onChange={e => set('rm_resolved', e.target.value === '1')}>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Company Resolved</label>
                <select disabled={!canEdit} className="form-control" value={form.company_resolved ? '1' : '0'} onChange={e => set('company_resolved', e.target.value === '1')}>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
              <div className="form-group full">
                <label className="form-label">Remarks</label>
                <textarea disabled={!canEdit} className="form-control" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="status-row">
            <span>Status (auto-computed)</span>
            <span className={`badge ${form.rm_resolved && form.company_resolved ? 'resolved' : 'pending'}`}>
              {form.rm_resolved && form.company_resolved ? 'Resolved' : 'Pending'}
            </span>
          </div>
        </div>

        <div className="modal-footer">
          {canEdit && (
            <button className="btn danger" onClick={remove} disabled={saving || deleting}>
              {deleting ? 'Deleting…' : 'Delete Policy'}
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
         <button
  className="btn primary"
  onClick={save}
  disabled={saving || deleting || !canEdit}
  title={!canEdit ? "Read-only access" : ""}
>
  {saving ? 'Saving…' : 'Save Changes'}
</button>
        </div>
      </div>
    </div>
  );
}
