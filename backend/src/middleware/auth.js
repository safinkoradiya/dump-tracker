import jwt from "jsonwebtoken";
import { query } from "../db/pool.js";
import {
  canManageData,
  canManageUsers,
  canViewDiscrepancyModule,
  canViewDiscrepancyRmTracking,
  canViewRenewalModule,
  canViewRenewalRmTracking,
  serializeUser,
} from "../lib/access.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(401).json({ error: "No token" });
  }

  const token = auth.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const result = await query(
      `SELECT id, username, role, permissions, assigned_rm, created_at
       FROM users
       WHERE id = $1`,
      [payload.id]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    req.user = serializeUser(result.rows[0]);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req, res, next) {
  if (!canManageUsers(req.user)) {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
}

export function requireDataManage(req, res, next) {
  if (!canManageData(req.user)) {
    return res.status(403).json({ error: "Read-only access" });
  }
  next();
}

export function requireDiscrepancyView(req, res, next) {
  if (!canViewDiscrepancyModule(req.user)) {
    return res.status(403).json({ error: "Discrepancy access denied" });
  }
  next();
}

export function requireDiscrepancyRmAccess(req, res, next) {
  if (!canViewDiscrepancyRmTracking(req.user)) {
    return res.status(403).json({ error: "Discrepancy RM access denied" });
  }
  next();
}

export function requireRenewalView(req, res, next) {
  if (!canViewRenewalModule(req.user)) {
    return res.status(403).json({ error: "Renewal access denied" });
  }
  next();
}

export function requireRenewalRmAccess(req, res, next) {
  if (!canViewRenewalRmTracking(req.user)) {
    return res.status(403).json({ error: "Renewal RM access denied" });
  }
  next();
}
