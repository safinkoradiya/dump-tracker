import { useRef, useState } from 'react';
import { createRenewalDump, importRenewalFile } from '../lib/api.js';
import { useToast } from './Toast.jsx';

export default function NewRenewalDumpModal({ onClose, onCreated }) {
  const toast = useToast();
  const fileRef = useRef();
  const [form, setForm] = useState({
    company: '',
    upload_date: new Date().toISOString().slice(0, 10),
    remarks: '',
  });
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleFile = (selectedFile) => {
    if (selectedFile && (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls') || selectedFile.name.endsWith('.csv'))) {
      setFile(selectedFile);
      return;
    }
    toast('Please upload an Excel or CSV file', 'error');
  };

  const save = async () => {
    if (!form.company) return toast('Renewal dump name/company is required', 'error');
    if (!form.upload_date) return toast('Upload date is required', 'error');
    if (!file) return toast('Renewal Excel file is required', 'error');

    setSaving(true);
    try {
      const dumpRes = await createRenewalDump(form);
      const dump = dumpRes.data;
      const importRes = await importRenewalFile(dump.id, file);
      toast(`Renewal dump ${dump.id} created · ${importRes.count} records imported`);
      onCreated(dump);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Upload Renewal Dump</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Renewal Dump / Company <span className="req">*</span></label>
              <input className="form-control" value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="e.g. April Renewal Batch" />
            </div>
            <div className="form-group">
              <label className="form-label">Upload Date <span className="req">*</span></label>
              <input className="form-control" type="date" value={form.upload_date} onChange={(e) => set('upload_date', e.target.value)} />
            </div>
            <div className="form-group full">
              <label className="form-label">Renewal Excel / CSV <span className="req">*</span></label>
              <div
                className={`upload-zone${drag ? ' drag' : ''}`}
                onClick={() => fileRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
              >
                <div style={{ fontSize: 28 }}>📂</div>
                <div className="upload-text">Upload the renewal workbook</div>
                <div className="upload-hint">All valid policy sheets will be auto-detected</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
              {file && (
                <div className="upload-preview">
                  <div className="upload-filename">📄 {file.name}</div>
                  <div className="upload-rows">{(file.size / 1024).toFixed(1)} KB — imported after dump creation</div>
                </div>
              )}
            </div>
            <div className="form-group full">
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows={2} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="Optional notes…" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? 'Creating…' : 'Create Renewal Dump'}
          </button>
        </div>
      </div>
    </div>
  );
}
