import express from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../db/pool.js";
import { authMiddleware, requireAdmin } from "../middleware/auth.js";
import { authEnv } from "../config/env.js";
import {
  normalizePermissions,
  normalizeRole,
  serializeUser,
} from "../lib/access.js";

const router = express.Router();

function normalizeAssignedRm(value) {
  return String(value || '').trim();
}

async function adminCount() {
  const result = await query(`SELECT COUNT(*)::int AS total FROM users WHERE role = 'admin'`);
  return result.rows[0]?.total || 0;
}

router.get('/me', authMiddleware, async (req, res) => {
  res.json({ data: req.user });
});

router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  const result = await query(`
    SELECT id, username, role, permissions, assigned_rm, created_at
    FROM users
    ORDER BY created_at DESC, username ASC
  `);

  res.json({ data: result.rows.map(serializeUser) });
});

router.post("/register", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username, password, role, permissions, assigned_rm } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const hash = await bcrypt.hash(password, 10);
    const userId = randomUUID();
    const userRole = normalizeRole(role);
    const userPermissions = normalizePermissions(permissions);
    const assignedRm = normalizeAssignedRm(assigned_rm);

    const result = await query(
      `INSERT INTO users (id, username, password, role, permissions, assigned_rm)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id, username, role, permissions, assigned_rm, created_at`,
      [userId, username.trim(), hash, userRole, JSON.stringify(userPermissions), assignedRm]
    );

    res.status(201).json({ data: serializeUser(result.rows[0]) });
  } catch (err) {
    console.error(err);

    if (err.code === "23505") {
      return res.status(400).json({ error: "Username already exists" });
    }

    res.status(500).json({ error: "Server error" });
  }
});

router.patch('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const result = await query(`SELECT * FROM users WHERE id = $1`, [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

  const current = result.rows[0];
  const nextRole = normalizeRole(req.body.role ?? current.role);
  const nextPermissions = normalizePermissions(req.body.permissions ?? current.permissions);
  const nextAssignedRm = req.body.assigned_rm !== undefined
    ? normalizeAssignedRm(req.body.assigned_rm)
    : normalizeAssignedRm(current.assigned_rm);

  if (current.role === 'admin' && nextRole !== 'admin' && await adminCount() <= 1) {
    return res.status(400).json({ error: 'At least one admin must remain' });
  }

  const nextUsername = String(req.body.username ?? current.username).trim();
  if (!nextUsername) return res.status(400).json({ error: 'Username is required' });

  let nextPassword = current.password;
  if (req.body.password) {
    nextPassword = await bcrypt.hash(req.body.password, 10);
  }

  try {
    const update = await query(
      `UPDATE users
       SET username = $1,
           password = $2,
           role = $3,
           permissions = $4::jsonb,
           assigned_rm = $5
       WHERE id = $6
       RETURNING id, username, role, permissions, assigned_rm, created_at`,
      [
        nextUsername,
        nextPassword,
        nextRole,
        JSON.stringify(nextPermissions),
        nextAssignedRm,
        req.params.id,
      ]
    );

    res.json({ data: serializeUser(update.rows[0]) });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  if (req.user.id === req.params.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  const targetRes = await query(`SELECT id, role FROM users WHERE id = $1`, [req.params.id]);
  if (!targetRes.rows.length) return res.status(404).json({ error: 'User not found' });

  if (targetRes.rows[0].role === 'admin' && await adminCount() <= 1) {
    return res.status(400).json({ error: 'At least one admin must remain' });
  }

  await query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
  res.json({ message: 'User deleted', id: req.params.id });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const result = await query(
    `SELECT id, username, password, role, permissions, assigned_rm, created_at
     FROM users
     WHERE username = $1`,
    [username]
  );

  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ error: "Invalid username" });
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = jwt.sign(
    { id: user.id },
    authEnv.JWT_SECRET,
    { expiresIn: "1d" }
  );

  const safeUser = serializeUser(user);
  res.json({
    token,
    ...safeUser,
  });
});

export default router;
