/**
 * Leave-module auth helpers.
 *
 * Wraps the shared auth middleware (requireAuth from auth.middleware.js)
 * and enriches req.user with employee_id and department_id lookups
 * needed by the leave controller's department-based auth checks.
 */

const { requireAuth } = require('../../shared/middleware/auth.middleware.js');
const Employee = require('../../shared/models/Employee');

/**
 * authenticate – runs the shared JWT middleware, then enriches req.user
 * with employee_id and department_id (which the JWT may not carry).
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
            req.user.department_id = employee.department_id;
          }
        } else if (!req.user.department_id) {
          // employee_id is in JWT but department_id isn't — look up department
          const employee = await Employee.findById(req.user.employee_id).lean();
          if (employee) {
            req.user.department_id = employee.department_id;
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
 * Must be placed AFTER `authenticate` in the middleware chain.
 * Returns 403 if the authenticated user's role is not in the allowed list.
 *
 * Usage: requireRole(['manager', 'admin'])
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
};

module.exports = { authenticate, requireRole };
