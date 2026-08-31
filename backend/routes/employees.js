/**
 * Sentinel — Employee Routes (async sqlite3)
 */

const router = require("express").Router();
const { get, all, run } = require("../db");
const { requireAuth }   = require("../middleware/auth");
const { requireRole }   = require("../middleware/roles");

const WRITE_ROLES = ["Manager", "Admin", "Super Admin"];

// ─── GET all ─────────────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  try {
    const { search, status, dept } = req.query;
    let query  = `
      SELECT e.*, d.name AS department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += " AND (LOWER(e.name) LIKE ? OR LOWER(e.email) LIKE ? OR LOWER(e.emp_id) LIKE ?)";
      const s = `%${search.toLowerCase()}%`;
      params.push(s, s, s);
    }
    if (status) { query += " AND e.status = ?"; params.push(status); }
    if (dept)   { query += " AND e.department_id = ?"; params.push(dept); }

    query += " ORDER BY e.name ASC";
    const rows = await all(query, params);
    res.json(rows);
  } catch (err) {
    console.error("[employees GET]", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── GET single ──────────────────────────────────────────────────────────────

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const emp = await get(
      "SELECT e.*, d.name AS department_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?",
      [req.params.id]
    );
    if (!emp) return res.status(404).json({ error: "Employee not found." });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST create ─────────────────────────────────────────────────────────────

router.post("/", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  try {
    const { emp_id, name, email, phone, role, department_id, status, join_date } = req.body ?? {};
    if (!emp_id || !name || !email) {
      return res.status(400).json({ error: "emp_id, name, and email are required." });
    }
    const result = await run(
      "INSERT INTO employees (emp_id, name, email, phone, role, department_id, status, join_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [emp_id, name, email.trim().toLowerCase(), phone ?? null, role ?? "Employee",
       department_id ?? null, status ?? "Active", join_date ?? null]
    );
    const created = await get("SELECT * FROM employees WHERE id = ?", [result.lastID]);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Employee ID or email already exists." });
    }
    console.error("[employees POST]", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── PUT update ──────────────────────────────────────────────────────────────

router.put("/:id", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  try {
    const emp = await get("SELECT id FROM employees WHERE id = ?", [req.params.id]);
    if (!emp) return res.status(404).json({ error: "Employee not found." });

    const { name, email, phone, role, department_id, status, join_date } = req.body ?? {};
    await run(`
      UPDATE employees
      SET name          = COALESCE(?, name),
          email         = COALESCE(?, email),
          phone         = COALESCE(?, phone),
          role          = COALESCE(?, role),
          department_id = COALESCE(?, department_id),
          status        = COALESCE(?, status),
          join_date     = COALESCE(?, join_date),
          updated_at    = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, email, phone, role, department_id, status, join_date, req.params.id]);

    const updated = await get("SELECT * FROM employees WHERE id = ?", [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error("[employees PUT]", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── DELETE ──────────────────────────────────────────────────────────────────

router.delete("/:id", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  try {
    const emp = await get("SELECT id FROM employees WHERE id = ?", [req.params.id]);
    if (!emp) return res.status(404).json({ error: "Employee not found." });
    await run("DELETE FROM employees WHERE id = ?", [req.params.id]);
    res.json({ message: "Employee deleted." });
  } catch (err) {
    console.error("[employees DELETE]", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
