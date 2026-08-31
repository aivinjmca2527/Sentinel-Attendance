const express = require('express');
const router = express.Router();
const authMiddleware = require('../../shared/middleware/auth.middleware');
const reportsController = require('./controller');

/**
 * RequireRole helper compatible with both the current auth stub
 * and future RBAC implementations.
 */
const requireRole = (roles = ['admin']) => {
  if (typeof authMiddleware === 'function' && typeof authMiddleware.requireRole === 'function') {
    return authMiddleware.requireRole(roles);
  }
  if (authMiddleware && typeof authMiddleware.requireRole === 'function') {
    return authMiddleware.requireRole(roles);
  }
  return (req, res, next) => {
    if (typeof authMiddleware === 'function') {
      return authMiddleware(req, res, (err) => {
        if (err) return next(err);
        if (req.user && req.user.role && !roles.includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            message: `Access denied. Requires one of roles: ${roles.join(', ')}`
          });
        }
        next();
      });
    }
    next();
  };
};

// Protect all reports routes for admin only
router.use(requireRole(['admin']));

router.get('/organisation', reportsController.getOrganisationReport);

module.exports = router;
