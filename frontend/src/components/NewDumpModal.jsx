import { useState, useRef } from 'react';
import { createDump, importFile } from '../lib/api.js';
import { useToast } from './Toast.jsx';

export default function NewDumpModal({ onClose, onCreated }) {
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

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = f => {
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv'))) {
      setFile(f);
    } else {
      toast('Please upload an Excel or CSV file', 'error');
    }
  };

  const save = async () => {
    if (!form.company) return toast('Company name is required', 'error');
    if (!form.upload_date) return toast('Upload date is required', 'error');
    setSaving(true);
    try {
      const dumpRes = await createDump(form);
      const dump = dumpRes.data;
      let importCount = 0;
      if (file) {
        const imp = await importFile(dump.id, file);
        importCount = imp.count;
      }
      toast(`Dump ${dump.id} created${importCount ? ` · ${importCount} policies imported` : ''}`);
      onCreated(dump);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Upload New Dump</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Insurance Company <span className="req">*</span></label>
              <input className="form-control" list="company-list" placeholder="e.g. LIC, HDFC Life"
                value={form.company} onChange={e => set('company', e.target.value)} />
              <datalist id="company-list">
                {['LIC','HDFC Life','ICICI Prudential','SBI Life','Bajaj Allianz','Max Life','Tata AIA','Kotak Life','Reliance Life','PNB MetLife']
                  .map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Upload Date <span className="req">*</span></label>
              <input className="form-control" type="date" value={form.upload_date} onChange={e => set('upload_date', e.target.value)} />
            </div>
            <div className="form-group full">
              <label className="form-label">Excel / CSV File</label>
              <div
                className={`upload-zone${drag ? ' drag' : ''}`}
                onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
              >
                <div style={{ fontSize: 28 }}>📂</div>
                <div className="upload-text">Click to browse or drag & drop</div>
                <div className="upload-hint">Supports .xlsx, .xls, .csv</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
              {file && (
                <div className="upload-preview">
                  <div className="upload-filename">📄 {file.name}</div>
                  <div className="upload-rows">{(file.size / 1024).toFixed(1)} KB — will be imported after save</div>
                </div>
              )}
            </div>
            <div className="form-group full">
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows={2} placeholder="Optional notes…"
                value={form.remarks} onChange={e => set('remarks', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create Dump'}</button>
        </div>
      </div>
    </div>
  );
}