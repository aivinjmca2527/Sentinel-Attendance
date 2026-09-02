/**
 * Leave-module auth helpers.
 *
 * Wraps the shared auth middleware (which will eventually do real JWT
 * validation, implemented by Nandana) and adds role-gating logic.
 *
 * DEV / TESTING MODE:
 *   While the shared middleware is still a pass-through stub, callers can
 *   send these headers to simulate an authenticated user:
 *     x-user-id    – the User._id  (maps to User document)
 *     x-user-role  – 'employee' | 'manager' | 'admin'
 *     x-employee-id – the Employee._id (maps to Employee document)
 *   Once real JWT auth is wired, these fallback headers will be ignored
 *   because req.user will already be populated by the shared middleware.
 */

const { requireAuth: sharedAuth } = require('../../shared/middleware/auth.middleware.js');
const User       = require('../../shared/models/User');
const Employee   = require('../../shared/models/Employee');

/**
 * authenticate – runs the shared middleware, then ensures req.user exists.
 * If the shared middleware didn't populate req.user (stub mode), we fall
 * back to dev headers so the module can be tested before JWT is live.
 */
const authenticate = async (req, res, next) => {
  // Run the shared middleware first (will populate req.user once real JWT is in)
  sharedAuth(req, res, async (err) => {
    if (err) return next(err);

    // If req.user is already set by real auth, carry on
    if (req.user && req.user._id) return next();

    // ---------- DEV FALLBACK (remove once real auth is live) ----------
    const userId     = req.headers['x-user-id'];
    const userRole   = req.headers['x-user-role'];
    const employeeId = req.headers['x-employee-id'];

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
      const user = await User.findById(userId).lean();
      if (!user) {
        return res.status(401).json({ error: 'User not found.' });
      }

      // Resolve the associated Employee record
      let employee = null;
      if (employeeId) {
        employee = await Employee.findById(employeeId).lean();
      } else {
        employee = await Employee.findOne({ user_id: userId }).lean();
      }

      req.user = {
        _id:           user._id,
        role:          userRole || user.role,
        name:          user.name,
        employee_id:   employee ? employee._id : null,
        department_id: employee ? employee.department_id : null,
      };

      next();
    } catch (error) {
      return res.status(500).json({ error: 'Auth lookup failed.' });
    }
    // ---------- END DEV FALLBACK ----------
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
