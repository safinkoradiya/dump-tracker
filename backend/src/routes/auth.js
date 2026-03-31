import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db/pool.js";

import { query } from "../db/pool.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
// ✅ REGISTER USER
router.post("/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 🔐 hash password
    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role",
      [username, hash, role || "viewer"]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);

    if (err.code === "23505") {
      return res.status(400).json({ error: "Username already exists" });
    }

    res.status(500).json({ error: "Server error" });
  }
});
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const result = await query(
    "SELECT * FROM users WHERE username = $1",
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
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({
  token,
  role: user.role,
  username: user.username
});
});


export default router;