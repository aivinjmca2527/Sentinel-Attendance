/**
 * Sentinel — Employees Controller (Module 1: Melbin)
 * Refactored to use Mongoose models to comply with project spec.
 */

const User = require("../../shared/models/User");
const Employee = require("../../shared/models/Employee");
const Department = require("../../shared/models/Department");
const bcrypt = require("bcryptjs");

const WRITE_ROLES = ["manager", "admin"];

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET all employees ───────────────────────────────────────────────────────

exports.listEmployees = async (req, res) => {
  try {
    const { search, status, dept } = req.query;
    
    let matchQuery = {};
    if (status) matchQuery.status = status;
    if (dept) matchQuery.department_id = dept;

    let employees = await Employee.find(matchQuery)
      .populate("user_id", "name email")
      .populate("department_id", "department_name")
      .lean();

    // Map to flat structure for frontend compatibility
    let mapped = employees.map(e => ({
      id: e._id,
      emp_id: e._id, // we don't have emp_id in mongoose schema, using _id
      name: e.user_id ? e.user_id.name : "Unknown",
      email: e.user_id ? e.user_id.email : "Unknown",
      phone: e.contact_number,
      department_id: e.department_id ? e.department_id._id : null,
      department_name: e.department_id ? e.department_id.department_name : null,
      status: e.status,
      join_date: e.date_of_joining,
      designation: e.designation
    }));

    if (search) {
      const s = search.toLowerCase();
      mapped = mapped.filter(e => 
        e.name.toLowerCase().includes(s) || 
        e.email.toLowerCase().includes(s)
      );
    }

    mapped.sort((a, b) => a.name.localeCompare(b.name));
    res.json(mapped);
  } catch (err) {
    console.error("[employees GET]", err);
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── GET single employee ─────────────────────────────────────────────────────

exports.getEmployee = async (req, res) => {
  try {
    const e = await Employee.findById(req.params.id)
      .populate("user_id", "name email")
      .populate("department_id", "department_name")
      .lean();
      
    if (!e) return res.status(404).json({ error: "Employee not found." });
    
    res.json({
      id: e._id,
      name: e.user_id ? e.user_id.name : "Unknown",
      email: e.user_id ? e.user_id.email : "Unknown",
      phone: e.contact_number,
      department_id: e.department_id ? e.department_id._id : null,
      department_name: e.department_id ? e.department_id.department_name : null,
      status: e.status,
      join_date: e.date_of_joining,
      designation: e.designation
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── POST create employee ────────────────────────────────────────────────────

exports.createEmployee = async (req, res) => {
  try {
    const { name, email, phone, role, department_id, status, join_date, designation } = req.body || {};
    if (!name || !email || !designation) {
      return res.status(400).json({ error: "name, email, and designation are required." });
    }
    
    // Check if user email exists
    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: "Email already exists." });
    }

    // Create User first
    const defaultPassword = bcrypt.hashSync("Welcome@123", 10);
    const newUser = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: defaultPassword,
      role: role || "employee"
    });

    // Create Employee
    const newEmployee = await Employee.create({
      user_id: newUser._id,
      department_id: department_id || null,
      designation: designation,
      contact_number: phone || null,
      date_of_joining: join_date || new Date(),
      status: status || "active"
    });

    res.status(201).json(newEmployee);
  } catch (err) {
    console.error("[employees POST]", err);
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── PUT update employee ─────────────────────────────────────────────────────

exports.updateEmployee = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: "Employee not found." });

    const { name, email, phone, role, department_id, status, join_date, designation } = req.body || {};
    
    if (name || email || role) {
      const user = await User.findById(emp.user_id);
      if (user) {
        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;
        await user.save();
      }
    }
    
    if (phone !== undefined) emp.contact_number = phone;
    if (department_id !== undefined) emp.department_id = department_id;
    if (status !== undefined) emp.status = status;
    if (join_date !== undefined) emp.date_of_joining = join_date;
    if (designation !== undefined) emp.designation = designation;
    
    await emp.save();

    res.json(emp);
  } catch (err) {
    console.error("[employees PUT]", err);
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── DELETE employee ─────────────────────────────────────────────────────────

exports.deleteEmployee = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: "Employee not found." });
    
    // Delete associated user
    await User.findByIdAndDelete(emp.user_id);
    // Delete employee
    await Employee.findByIdAndDelete(req.params.id);
    
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
    const depts = await Department.find().lean();
    
    // Calculate employee count for each department
    const results = [];
    for (const d of depts) {
      const count = await Employee.countDocuments({ department_id: d._id });
      results.push({
        id: d._id,
        name: d.department_name,
        manager: d.manager_id,
        employee_count: count
      });
    }
    
    results.sort((a, b) => a.name.localeCompare(b.name));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── GET single department ───────────────────────────────────────────────────

exports.getDepartment = async (req, res) => {
  try {
    const d = await Department.findById(req.params.id).lean();
    if (!d) return res.status(404).json({ error: "Department not found." });
    res.json({
        id: d._id,
        name: d.department_name,
        manager: d.manager_id
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── POST create department ──────────────────────────────────────────────────

exports.createDepartment = async (req, res) => {
  try {
    const { name, manager } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: "name is required." });
    }
    
    const existing = await Department.findOne({ department_name: name.trim() });
    if (existing) {
        return res.status(409).json({ error: "Department name already exists." });
    }

    const newDept = await Department.create({
      department_name: name.trim(),
      manager_id: manager || null
    });
    
    res.status(201).json(newDept);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── PUT update department ───────────────────────────────────────────────────

exports.updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ error: "Department not found." });

    const { name, manager } = req.body || {};
    
    if (name) dept.department_name = name.trim();
    if (manager !== undefined) dept.manager_id = manager;
    
    await dept.save();
    res.json(dept);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── DELETE department ───────────────────────────────────────────────────────

exports.deleteDepartment = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ error: "Department not found." });

    const empCount = await Employee.countDocuments({ department_id: req.params.id });
    if (empCount > 0) {
      return res.status(409).json({ error: `Cannot delete: ${empCount} employee(s) still assigned to this department.` });
    }
    
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: "Department deleted." });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
};
