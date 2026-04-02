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
  summarizePermissions,
} from "../lib/access.js";
import { accessSummary, recordAuditLog } from "../lib/audit.js";

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

    const createdUser = serializeUser(result.rows[0]);
    await recordAuditLog({
      req,
      action: 'user.create',
      entityType: 'user',
      entityId: createdUser.id,
      entityLabel: createdUser.username,
      details: {
        summary: `Created user with ${accessSummary(createdUser)}`,
        role: createdUser.role,
        permissions: createdUser.permissions,
        assigned_rm: createdUser.assigned_rm,
      },
    });

    res.status(201).json({ data: createdUser });
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
  const changed = [];
  if (current.username !== nextUsername) changed.push('username');
  if (current.role !== nextRole) changed.push('role');
  if (JSON.stringify(normalizePermissions(current.permissions)) !== JSON.stringify(nextPermissions)) changed.push('permissions');
  if (normalizeAssignedRm(current.assigned_rm) !== nextAssignedRm) changed.push('assigned_rm');
  if (req.body.password) {
    nextPassword = await bcrypt.hash(req.body.password, 10);
    changed.push('password');
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

    const updatedUser = serializeUser(update.rows[0]);
    await recordAuditLog({
      req,
      action: 'user.update',
      entityType: 'user',
      entityId: updatedUser.id,
      entityLabel: updatedUser.username,
      details: {
        summary: changed.length
          ? `Updated ${changed.join(', ')}`
          : `Saved user with ${accessSummary(updatedUser)}`,
        changed_fields: changed,
        previous_role: current.role,
        next_role: updatedUser.role,
        previous_access: summarizePermissions(current),
        next_access: accessSummary(updatedUser),
      },
    });

    res.json({ data: updatedUser });
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

  const targetRes = await query(`SELECT id, username, role, permissions, assigned_rm FROM users WHERE id = $1`, [req.params.id]);
  if (!targetRes.rows.length) return res.status(404).json({ error: 'User not found' });

  if (targetRes.rows[0].role === 'admin' && await adminCount() <= 1) {
    return res.status(400).json({ error: 'At least one admin must remain' });
  }

  const targetUser = serializeUser(targetRes.rows[0]);
  await query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
  await recordAuditLog({
    req,
    action: 'user.delete',
    entityType: 'user',
    entityId: targetUser.id,
    entityLabel: targetUser.username,
    details: {
      summary: `Deleted user with ${accessSummary(targetUser)}`,
      role: targetUser.role,
      permissions: targetUser.permissions,
      assigned_rm: targetUser.assigned_rm,
    },
  });
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
  await recordAuditLog({
    req,
    actor: safeUser,
    action: 'auth.login',
    entityType: 'session',
    entityId: safeUser.id,
    entityLabel: safeUser.username,
    details: {
      summary: 'Successful login',
      role: safeUser.role,
      access: accessSummary(safeUser),
    },
  });
  res.json({
    token,
    ...safeUser,
  });
});

export default router;
