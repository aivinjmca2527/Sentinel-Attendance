/**
 * Sentinel — Employees Controller (Module 1: Melbin)
 * Migrated from backend/routes/employees.js + backend/routes/departments.js
 * onto the shared scaffold.
 *
 * Handles both Employee CRUD and Department CRUD.
 */

const { get, all, run } = require("../../shared/config/db");

const WRITE_ROLES = ["Manager", "Admin", "Super Admin"];

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET all employees ───────────────────────────────────────────────────────

exports.listEmployees = async (req, res) => {
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
};

// ─── GET single employee ─────────────────────────────────────────────────────

exports.getEmployee = async (req, res) => {
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
};

// ─── POST create employee ────────────────────────────────────────────────────

exports.createEmployee = async (req, res) => {
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
};

// ─── PUT update employee ─────────────────────────────────────────────────────

exports.updateEmployee = async (req, res) => {
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
};

// ─── DELETE employee ─────────────────────────────────────────────────────────

exports.deleteEmployee = async (req, res) => {
  try {
    const emp = await get("SELECT id FROM employees WHERE id = ?", [req.params.id]);
    if (!emp) return res.status(404).json({ error: "Employee not found." });
    await run("DELETE FROM employees WHERE id = ?", [req.params.id]);
    res.json({ message: "Employee deleted." });
  } catch (err) {
    console.error("[employees DELETE]", err);
    res.status(500).json({ error: "Internal server error." });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET all departments ─────────────────────────────────────────────────────

exports.listDepartments = async (req, res) => {
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
};

// ─── GET single department ───────────────────────────────────────────────────

exports.getDepartment = async (req, res) => {
  try {
    const dept = await get("SELECT * FROM departments WHERE id = ?", [req.params.id]);
    if (!dept) return res.status(404).json({ error: "Department not found." });
    res.json(dept);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── POST create department ──────────────────────────────────────────────────

exports.createDepartment = async (req, res) => {
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
};

// ─── PUT update department ───────────────────────────────────────────────────

exports.updateDepartment = async (req, res) => {
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
};

// ─── DELETE department ───────────────────────────────────────────────────────

exports.deleteDepartment = async (req, res) => {
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
};
