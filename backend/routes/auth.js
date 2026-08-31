/**
 * Sentinel — Auth Routes (async sqlite3)
 */

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");

const { get, run } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { JWT_SECRET } = require("../server");

const TOTP_REQUIRED_ROLES = ["Manager", "Admin", "Super Admin"];

function makeJWT(user, isTemp = false) {
  return jwt.sign(
    {
      id:            user.id,
      name:          user.name,
      email:         user.email,
      role:          user.role,
      initials:      user.initials,
      department_id: user.department_id,
      temp:          isTemp,
    },
    JWT_SECRET,
    { expiresIn: isTemp ? "10m" : "8h" }
  );
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await get(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
      [email.trim()]
    );

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const needsTotp = TOTP_REQUIRED_ROLES.includes(user.role);

    if (needsTotp && !user.totp_enabled) {
      const tempToken = makeJWT(user, true);
      return res.json({ requireTotpSetup: true, tempToken });
    }

    if (needsTotp && user.totp_enabled) {
      const tempToken = makeJWT(user, true);
      return res.json({ requireTotp: true, tempToken });
    }

    const token = makeJWT(user, false);
    res.json({
      token,
      user: { name: user.name, email: user.email, role: user.role, initials: user.initials },
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/totp/setup ───────────────────────────────────────────────

router.post("/totp/setup", requireAuth, async (req, res) => {
  try {
    if (!req.user.temp) {
      return res.status(403).json({ error: "Full JWT cannot be used for TOTP setup." });
    }

    const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    if (!user) return res.status(404).json({ error: "User not found." });

    const secret     = authenticator.generateSecret();
    await run("UPDATE users SET totp_secret = ? WHERE id = ?", [secret, user.id]);

    const otpAuthUrl = authenticator.keyuri(user.email, "Sentinel", secret);
    const qrDataUrl  = await QRCode.toDataURL(otpAuthUrl);

    res.json({ secret, qrDataUrl, otpAuthUrl });
  } catch (err) {
    console.error("[totp/setup]", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/totp/verify ──────────────────────────────────────────────

router.post("/totp/verify", requireAuth, async (req, res) => {
  try {
    if (!req.user.temp) {
      return res.status(403).json({ error: "Use your temp token for TOTP verification." });
    }

    const { code } = req.body ?? {};
    if (!code) return res.status(400).json({ error: "TOTP code is required." });

    const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: "TOTP not configured for this account." });
    }

    const isValid = authenticator.verify({ token: code, secret: user.totp_secret });
    if (!isValid) {
      return res.status(401).json({ error: "Invalid or expired TOTP code." });
    }

    await run("UPDATE users SET totp_enabled = 1 WHERE id = ?", [user.id]);
    const token = makeJWT({ ...user, totp_enabled: 1 }, false);

    res.json({
      token,
      user: { name: user.name, email: user.email, role: user.role, initials: user.initials },
    });
  } catch (err) {
    console.error("[totp/verify]", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req, res) => {
  try {
    if (req.user.temp) {
      return res.status(403).json({ error: "Complete TOTP verification first." });
    }
    const user = await get(
      "SELECT u.id, u.name, u.email, u.role, u.initials, d.name as department FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?",
      [req.user.id]
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

router.post("/logout", (_req, res) => {
  res.json({ message: "Logged out successfully." });
});

module.exports = router;
