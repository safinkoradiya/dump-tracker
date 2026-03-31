import { query } from '../db/pool.js';

// Generates sequential IDs like DMP-001, POL-042 using DB sequences
export async function nextDumpId() {
  const res = await query(`
    SELECT LPAD(nextval('dump_id_seq')::TEXT, 3, '0') AS num
  `);
  return `DMP-${res.rows[0].num}`;
}

export async function nextPolicyId() {
  const res = await query(`
    SELECT LPAD(nextval('policy_id_seq')::TEXT, 3, '0') AS num
  `);
  return `POL-${res.rows[0].num}`;
}

export async function ensureSequences() {
  await query(`CREATE SEQUENCE IF NOT EXISTS dump_id_seq START 1;`);
  await query(`CREATE SEQUENCE IF NOT EXISTS policy_id_seq START 1;`);
}