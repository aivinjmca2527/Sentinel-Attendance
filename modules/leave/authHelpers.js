/**
 * Leave-module auth helpers.
 *
 * Wraps the shared auth middleware (requireAuth from auth.middleware.js)
 * and enriches req.user with employee_id and department_id lookups
 * needed by the leave controller's department-based auth checks.
 */

const { requireAuth, getManagerDepartment } = require('../../shared/middleware/auth.middleware.js');
const Employee = require('../../shared/models/Employee');

/**
 * authenticate – runs the shared JWT middleware, then enriches req.user
 * with employee_id and department_id using shared getManagerDepartment.
 */
const authenticate = async (req, res, next) => {
  // Run the shared JWT middleware first
  requireAuth(req, res, async (err) => {
    if (err) return next(err);

    // If req.user exists (set by requireAuth from JWT), enrich it
    if (req.user) {
      try {
        // JWT payload uses 'id' not '_id', normalize
        if (!req.user._id && req.user.id) {
          req.user._id = req.user.id;
        }

        // If employee_id is already in JWT, great; otherwise look it up
        if (!req.user.employee_id) {
          const employee = await Employee.findOne({ user_id: req.user._id }).lean();
          if (employee) {
            req.user.employee_id = employee._id;
            if (employee.department_id) {
              req.user.department_id = employee.department_id;
            }
          }
        }

        // Use shared getManagerDepartment helper for manager department resolution
        const role = (req.user.role || '').toLowerCase();
        if (role === 'manager' && !req.user.department_id) {
          const deptId = await getManagerDepartment(req.user._id, req.user.employee_id);
          if (deptId) {
            req.user.department_id = deptId;
          }
        }

        return next();
      } catch (lookupErr) {
        console.error('Auth enrichment error:', lookupErr);
        return res.status(500).json({ error: 'Auth lookup failed.' });
      }
    }

    return res.status(401).json({ error: 'Authentication required.' });
  });
};

/**
 * requireRole(roles) – middleware factory.
 * Case-insensitive comparison.
 */
const requireRole = (...roles) => {
  const allowed = roles.flat().map(r => String(r).toLowerCase());
  return (req, res, next) => {
    const userRole = req.user?.role ? String(req.user.role).toLowerCase() : '';
    if (!req.user || !allowed.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
};

module.exports = { authenticate, requireRole };
