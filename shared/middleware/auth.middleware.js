/**
 * Sentinel — Auth Middleware (JWT + Role Guard)
 * Merged from backend/middleware/auth.js + backend/middleware/roles.js
 *
 * Usage:
 *   const { requireAuth, requireRole } = require('../../shared/middleware/auth.middleware');
 *   router.get('/protected', requireAuth, requireRole('Manager', 'Admin'), handler);
 */

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "sentinel_dev_secret_change_in_production";

/**
 * Verify Bearer token and attach req.user
 */
function requireAuth(req, res, next) {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header." });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token expired or invalid." });
  }
}

/**
 * Role-guard middleware factory
 * Usage: requireRole('Manager', 'Admin', 'Super Admin')
 */
function requireRole(...roles) {
  const allowed = roles.flat().map(r => String(r).toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    const userRole = req.user.role ? String(req.user.role).toLowerCase() : '';
    if (!allowed.includes(userRole)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowed.join(" or ")}.`,
      });
    }
    next();
  };
}

/**
 * Helper: Reliably resolves a manager's department_id by checking:
 * 1. Employee.department_id (for the given employeeId or userId)
 * 2. Department.findOne({ manager_id: targetEmpId })
 * Returns department_id (as string/ObjectId) if found, or null if neither resolves.
 */
async function getManagerDepartment(userId, employeeId) {
  try {
    const User = require('../models/User');
    const Employee = require('../models/Employee');
    const Department = require('../models/Department');

    let emp = null;
    let targetUserId = userId;

    if (employeeId) {
      emp = await Employee.findById(employeeId).lean();
      if (emp && !targetUserId) {
        targetUserId = emp.user_id;
      }
    }

    if (!emp && targetUserId) {
      emp = await Employee.findOne({ user_id: targetUserId }).lean();
    }

    // If target user exists and role is known, verify user is a manager
    if (targetUserId) {
      const user = await User.findById(targetUserId).select('role').lean();
      if (user && user.role && String(user.role).toLowerCase() !== 'manager') {
        return null;
      }
    }

    if (!emp) {
      return null;
    }

    // 1. Check Employee.department_id
    if (emp.department_id) {
      return emp.department_id;
    }

    // 2. Check Department.findOne({ manager_id: targetEmpId })
    const targetEmpId = emp._id || employeeId;
    if (targetEmpId) {
      const dept = await Department.findOne({ manager_id: targetEmpId }).select('_id').lean();
      if (dept && dept._id) {
        return dept._id;
      }
    }

    return null;
  } catch (err) {
    console.error('[getManagerDepartment] Error resolving manager department:', err);
    return null;
  }
}

module.exports = { requireAuth, requireRole, getManagerDepartment, JWT_SECRET };
