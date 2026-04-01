import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import pool from "./pool.js";

dotenv.config();

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const role = "admin";

async function seedUser() {
  if (!username || !password) {
    console.error("Missing ADMIN_USERNAME or ADMIN_PASSWORD");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `
      INSERT INTO users (id, username, password, role, permissions, assigned_rm)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      ON CONFLICT (username)
      DO UPDATE SET
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        permissions = EXCLUDED.permissions,
        assigned_rm = EXCLUDED.assigned_rm
      RETURNING id, username, role, permissions, assigned_rm
    `,
    [randomUUID(), username, hash, role, JSON.stringify({ fullAccess: true }), '']
  );

  console.log("Seeded user:", result.rows[0]);
  process.exit(0);
}

seedUser().catch((err) => {
  console.error("User seed failed:", err);
  process.exit(1);
});
