import express from "express";
import ExcelJS from "exceljs";
import pool from "../db/pool.js";
import { authMiddleware, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.post("/excel", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { fields = [], dumpIds = [] } = req.body;

    if (!fields.length) {
      return res.status(400).json({ error: "No fields selected" });
    }

    // Build SELECT dynamically
    const fieldMap = {
      policy_no: "p.policy_no",
      dump_id: "p.dump_id",
      rm_name: "p.rm_name",
      imd_name: "p.imd_name",
      recv_date: "p.recv_date",
      rm_response: "p.rm_response",
      pending_side: "p.pending_side",
      status: `(CASE WHEN p.rm_resolved AND p.company_resolved THEN 'Resolved' ELSE 'Pending' END)`,

      // extra fields
      regNo: "p.extra->>'regNo'",
      ageing: "p.extra->>'ageing'",
      branch: "p.extra->>'branch'",
      premium: "p.extra->>'premium'",
      product: "p.extra->>'product'",
      customerName: "p.extra->>'customerName'",
      policyStatus: "p.extra->>'policyStatus'",
    };

    const selectFields = fields.map(f => `${fieldMap[f]} AS "${f}"`).join(", ");

    let query = `
      SELECT ${selectFields}
      FROM policies p
    `;

    if (dumpIds.length) {
      query += ` WHERE p.dump_id = ANY($1)`;
    }

    const { rows } = await pool.query(query, dumpIds.length ? [dumpIds] : []);

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Export");

    // Columns
    sheet.columns = fields.map(f => ({
      header: f,
      key: f,
      width: 20
    }));

    rows.forEach(r => sheet.addRow(r));

    // Styling (basic)
    sheet.getRow(1).font = { bold: true };

    // Response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=export.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Export failed" });
  }
});

export default router;