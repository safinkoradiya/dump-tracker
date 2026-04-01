import express from 'express';
import ExcelJS from 'exceljs';
import pool from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/excel', requireAdmin, async (req, res) => {
  try {
    const { fields = [], dumpIds = [] } = req.body;
    if (!fields.length) return res.status(400).json({ error: 'No fields selected' });

    const fieldMap = {
      renewal_dump_id: 'r.renewal_dump_id',
      sheet_name: 'r.sheet_name',
      policy_number: 'r.policy_number',
      original_policy_number: 'r.original_policy_number',
      policy_holder_name: 'r.policy_holder_name',
      policy_holder_phone: 'r.policy_holder_phone',
      policy_holder_email: 'r.policy_holder_email',
      insurer: 'r.insurer',
      broker_name: 'r.broker_name',
      rm_name: 'r.rm_name',
      source_rm: 'r.source_rm',
      latest_rm: 'r.latest_rm',
      source_partner: 'r.source_partner',
      vehicle_number: 'r.vehicle_number',
      vehicle_make: 'r.vehicle_make',
      vehicle_model: 'r.vehicle_model',
      vehicle_variant: 'r.vehicle_variant',
      policy_type: 'r.policy_type',
      vehicle_class: 'r.vehicle_class',
      policy_valid_from: 'r.policy_valid_from',
      policy_valid_till: 'r.policy_valid_till',
      od_end_date: 'r.od_end_date',
      tp_end_date: 'r.tp_end_date',
      inwarding_date: 'r.inwarding_date',
      net_premium: 'r.net_premium',
      total_premium_amount: 'r.total_premium_amount',
      status: 'r.status',
      customer_response: 'r.customer_response',
      pending_with: 'r.pending_with',
      next_follow_up_date: 'r.next_follow_up_date',
      quoted_premium: 'r.quoted_premium',
      renewed_premium: 'r.renewed_premium',
      renewed_insurer: 'r.renewed_insurer',
      renewed_on: 'r.renewed_on',
      remarks: 'r.remarks',
    };

    const selectFields = fields
      .filter((field) => fieldMap[field])
      .map((field) => `${fieldMap[field]} AS "${field}"`)
      .join(', ');

    if (!selectFields) return res.status(400).json({ error: 'No valid fields selected' });

    const params = [];
    let where = 'WHERE r.deleted_at IS NULL';
    if (dumpIds.length) {
      params.push(dumpIds);
      where += ` AND r.renewal_dump_id = ANY($${params.length})`;
    }

    const result = await pool.query(`
      SELECT ${selectFields}
      FROM renewals r
      ${where}
      ORDER BY r.policy_valid_till ASC NULLS LAST
    `, params);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Renewals');
    sheet.columns = fields.map((field) => ({ header: field, key: field, width: 22 }));
    result.rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=renewals-export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Renewal export failed' });
  }
});

export default router;
