/**
 * Sentinel — Department Routes (async sqlite3)
 */

const router = require("express").Router();
const { get, all, run } = require("../db");
const { requireAuth }   = require("../middleware/auth");
const { requireRole }   = require("../middleware/roles");

// ─── GET all ─────────────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  try {
    const rows = await all(`
      SELECT d.*, COUNT(e.id) AS employee_count
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      GROUP BY d.id
      ORDER BY d.name ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── GET single ──────────────────────────────────────────────────────────────

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const dept = await get("SELECT * FROM departments WHERE id = ?", [req.params.id]);
    if (!dept) return res.status(404).json({ error: "Department not found." });
    res.json(dept);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST create ─────────────────────────────────────────────────────────────

router.post("/", requireAuth, requireRole("Admin", "Super Admin"), async (req, res) => {
  try {
    const { name, code, manager } = req.body ?? {};
    if (!name || !code) {
      return res.status(400).json({ error: "name and code are required." });
    }
    const result = await run(
      "INSERT INTO departments (name, code, manager) VALUES (?, ?, ?)",
      [name.trim(), code.trim().toUpperCase(), manager ?? null]
    );
    const created = await get("SELECT * FROM departments WHERE id = ?", [result.lastID]);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Department name or code already exists." });
    }
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── PUT update ──────────────────────────────────────────────────────────────

router.put("/:id", requireAuth, requireRole("Admin", "Super Admin"), async (req, res) => {
  try {
    const dept = await get("SELECT id FROM departments WHERE id = ?", [req.params.id]);
    if (!dept) return res.status(404).json({ error: "Department not found." });

    const { name, code, manager } = req.body ?? {};
    await run(
      "UPDATE departments SET name = COALESCE(?, name), code = COALESCE(?, code), manager = COALESCE(?, manager) WHERE id = ?",
      [name, code, manager, req.params.id]
    );
    res.json(await get("SELECT * FROM departments WHERE id = ?", [req.params.id]));
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── DELETE ──────────────────────────────────────────────────────────────────

router.delete("/:id", requireAuth, requireRole("Super Admin"), async (req, res) => {
  try {
    const dept = await get("SELECT id FROM departments WHERE id = ?", [req.params.id]);
    if (!dept) return res.status(404).json({ error: "Department not found." });

    const empCount = await get("SELECT COUNT(*) as c FROM employees WHERE department_id = ?", [req.params.id]);
    if (empCount.c > 0) {
      return res.status(409).json({ error: `Cannot delete: ${empCount.c} employee(s) still assigned to this department.` });
    }
    await run("DELETE FROM departments WHERE id = ?", [req.params.id]);
    res.json({ message: "Department deleted." });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
