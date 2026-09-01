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
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(" or ")}.`,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };
