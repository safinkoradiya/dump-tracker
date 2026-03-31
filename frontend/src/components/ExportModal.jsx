import { useState } from "react";
import { exportExcel } from "../lib/api.js";
import { useToast } from "./Toast.jsx";

const FIELD_LABELS = {
  policy_no: "Policy Number",
  dump_id: "Dump ID",
  rm_name: "RM Name",
  imd_name: "IMD Name",
  recv_date: "Received Date",
  rm_response: "RM Response",
  pending_side: "Pending With",
  status: "Status",
  regNo: "Registration No",
  ageing: "Ageing",
  branch: "Branch",
  premium: "Premium",
  product: "Product",
  customerName: "Customer Name",
  policyStatus: "Policy Status"
};

const BASIC_FIELDS = [
  "policy_no","dump_id","rm_name","imd_name",
  "recv_date","rm_response","pending_side","status"
];

const EXTRA_FIELDS = [
  "regNo","ageing","branch","premium",
  "product","customerName","policyStatus"
];

export default function ExportModal({ dumps = [], onClose }) {
  const toast = useToast();
  const [selectedFields, setSelectedFields] = useState([]);
  const [selectedDumps, setSelectedDumps] = useState([]);

  const toggleField = (f) => {
    setSelectedFields(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  const toggleDump = (id) => {
    setSelectedDumps(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleExport = async () => {
    try {
      const blob = await exportExcel({
        fields: selectedFields,
        dumpIds: selectedDumps
      });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "export.xlsx";
      a.click();

      onClose();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">

        {/* Header */}
        <div className="modal-header">
          <h2>Export Data</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* BASIC FIELDS */}
        <div className="modal-section">
          <div className="section-header">
            <h4>Basic Fields</h4>
            <button
              className="link-btn"
              onClick={() => setSelectedFields(BASIC_FIELDS)}
            >
              Select All
            </button>
          </div>

          <div className="grid">
            {BASIC_FIELDS.map(f => (
              <label key={f} className="checkbox">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(f)}
                  onChange={() => toggleField(f)}
                />
                {FIELD_LABELS[f]}
              </label>
            ))}
          </div>
        </div>

        {/* EXTRA FIELDS */}
        <div className="modal-section">
          <div className="section-header">
            <h4>Extra Fields</h4>
            <button
              className="link-btn"
              onClick={() =>
                setSelectedFields(prev => [...new Set([...prev, ...EXTRA_FIELDS])])
              }
            >
              Select All
            </button>
          </div>

          <div className="grid">
            {EXTRA_FIELDS.map(f => (
              <label key={f} className="checkbox">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(f)}
                  onChange={() => toggleField(f)}
                />
                {FIELD_LABELS[f]}
              </label>
            ))}
          </div>
        </div>

        {/* DUMPS */}
        <div className="modal-section">
          <h4>Select Dumps</h4>
          <div className="grid">
            {dumps.map(d => (
              <label key={d.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={selectedDumps.includes(d.id)}
                  onChange={() => toggleDump(d.id)}
                />
                {d.id}
              </label>
            ))}
          </div>
        </div>

        {/* ACTION */}
        <button className="btn primary full" onClick={handleExport}>
          Export Excel
        </button>

      </div>
    </div>
  );
}
