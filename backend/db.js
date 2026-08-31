/**
 * Sentinel Attendance — SQLite Database (sqlite3 async)
 * Wraps the callback-based sqlite3 API in Promises for convenience.
 */

const sqlite3 = require("sqlite3").verbose();
const bcrypt  = require("bcryptjs");
const path    = require("path");

const DB_PATH = path.join(__dirname, "sentinel.db");
const db      = new sqlite3.Database(DB_PATH);

// ─── Promise helpers ─────────────────────────────────────────────────────────

const run = (sql, params = []) =>
  new Promise((res, rej) =>
    db.run(sql, params, function (err) { err ? rej(err) : res(this); })
  );

const get = (sql, params = []) =>
  new Promise((res, rej) =>
    db.get(sql, params, (err, row) => (err ? rej(err) : res(row)))
  );

const all = (sql, params = []) =>
  new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => (err ? rej(err) : res(rows)))
  );

// ─── Schema ─────────────────────────────────────────────────────────────────

async function initSchema() {
  await run("PRAGMA foreign_keys = ON");

  await run(`CREATE TABLE IF NOT EXISTS departments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    code       TEXT    NOT NULL UNIQUE,
    manager    TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    totp_secret   TEXT,
    totp_enabled  INTEGER NOT NULL DEFAULT 0,
    initials      TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS employees (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id        TEXT    NOT NULL UNIQUE,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    phone         TEXT,
    role          TEXT    NOT NULL DEFAULT 'Employee',
    department_id INTEGER REFERENCES departments(id),
    status        TEXT    NOT NULL DEFAULT 'Active',
    join_date     DATE,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS attendance_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id),
    date        DATE    NOT NULL,
    check_in    TIME,
    check_out   TIME,
    status      TEXT    NOT NULL DEFAULT 'Present',
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seedIfEmpty() {
  const deptRow = await get("SELECT COUNT(*) as c FROM departments");
  if (deptRow.c > 0) return;

  console.log("[DB] Seeding initial data…");

  const depts = [
    ["Engineering", "ENG", "John Doe"],
    ["Marketing",   "MKT", "Sarah Smith"],
    ["Operations",  "OPS", "Alex Reyes"],
    ["Sales",       "SLS", null],
    ["Human Resources", "HR", null],
  ];

  for (const [name, code, manager] of depts) {
    await run("INSERT INTO departments (name, code, manager) VALUES (?, ?, ?)", [name, code, manager]);
  }

  const rows = await all("SELECT id, code FROM departments");
  const deptMap = {};
  for (const r of rows) deptMap[r.code] = r.id;

  const users = [
    { name: "Alex Reyes",   email: "admin@sentinel.com",        password: "Admin@123",  role: "Super Admin", dept: "OPS", initials: "AR" },
    { name: "Sarah Smith",  email: "sarah.smith@sentinel.com",  password: "Sarah@123",  role: "Admin",       dept: "MKT", initials: "SS" },
    { name: "John Doe",     email: "john.doe@sentinel.com",     password: "John@123",   role: "Manager",     dept: "ENG", initials: "JD" },
    { name: "Mary Lee",     email: "mary.lee@sentinel.com",     password: "Mary@123",   role: "Employee",    dept: "HR",  initials: "ML" },
    { name: "Robert Jones", email: "robert.jones@sentinel.com", password: "Robert@123", role: "Employee",    dept: "SLS", initials: "RJ" },
  ];
  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 10);
    await run(
      "INSERT INTO users (name, email, password_hash, role, department_id, initials) VALUES (?, ?, ?, ?, ?, ?)",
      [u.name, u.email, hash, u.role, deptMap[u.dept], u.initials]
    );
  }

  const employees = [
    { id: "EMP001", name: "John Doe",     email: "john.doe@sentinel.com",     phone: "+1-555-0101", role: "Manager",    dept: "ENG", status: "Active",   join: "2021-03-15" },
    { id: "EMP002", name: "Sarah Smith",  email: "sarah.smith@sentinel.com",  phone: "+1-555-0102", role: "Admin",      dept: "MKT", status: "Active",   join: "2020-07-01" },
    { id: "EMP003", name: "Alex Reyes",   email: "admin@sentinel.com",        phone: "+1-555-0103", role: "Super Admin",dept: "OPS", status: "Active",   join: "2019-11-20" },
    { id: "EMP004", name: "Mary Lee",     email: "mary.lee@sentinel.com",     phone: "+1-555-0104", role: "Employee",   dept: "HR",  status: "Active",   join: "2022-01-10" },
    { id: "EMP005", name: "Robert Jones", email: "robert.jones@sentinel.com", phone: "+1-555-0105", role: "Employee",   dept: "SLS", status: "Active",   join: "2022-06-05" },
    { id: "EMP006", name: "Lisa Wong",    email: "lisa.wong@sentinel.com",    phone: "+1-555-0106", role: "Employee",   dept: "ENG", status: "Active",   join: "2023-02-14" },
    { id: "EMP007", name: "Carlos Vega",  email: "carlos.vega@sentinel.com",  phone: "+1-555-0107", role: "Employee",   dept: "MKT", status: "On Leave", join: "2021-09-30" },
    { id: "EMP008", name: "Nina Patel",   email: "nina.patel@sentinel.com",   phone: "+1-555-0108", role: "Employee",   dept: "OPS", status: "Inactive", join: "2020-04-17" },
  ];
  for (const e of employees) {
    await run(
      "INSERT INTO employees (emp_id, name, email, phone, role, department_id, status, join_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [e.id, e.name, e.email, e.phone, e.role, deptMap[e.dept], e.status, e.join]
    );
  }

  console.log("[DB] Seed complete.");
}

// ─── Initialize ──────────────────────────────────────────────────────────────

let ready = false;
const initPromise = initSchema().then(seedIfEmpty).then(() => { ready = true; });

module.exports = { db, run, get, all, initPromise };
