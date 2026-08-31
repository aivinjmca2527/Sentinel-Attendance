/**
 * JWT Authentication Middleware
 * Verifies Bearer token and attaches req.user
 */

const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../server");

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

module.exports = { requireAuth };
