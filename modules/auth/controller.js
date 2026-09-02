/**
 * Sentinel — Auth Controller (Module 1: Melbin)
 * Refactored to use Mongoose models to comply with project spec.
 */

const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");

const User = require("../../shared/models/User");
const Employee = require("../../shared/models/Employee");
const { JWT_SECRET } = require("../../shared/middleware/auth.middleware");

const TOTP_REQUIRED_ROLES = ["manager", "admin"];

function makeJWT(user, isTemp = false) {
  return jwt.sign(
    {
      id:            user._id,
      name:          user.name,
      email:         user.email,
      role:          user.role,
      employee_id:   user.employee_id,
      temp:          isTemp,
    },
    JWT_SECRET,
    { expiresIn: isTemp ? "10m" : "8h" }
  );
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Spec requires ignoring case for email
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email.trim()}$`, "i") } });

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

    const employee = await Employee.findOne({ user_id: user._id });
    if (employee) {
        user.employee_id = employee._id;
    }

    const token = makeJWT(user, false);
    res.json({
      token,
      user: { name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── POST /api/auth/totp/setup ───────────────────────────────────────────────

exports.totpSetup = async (req, res) => {
  try {
    if (!req.user.temp) {
      return res.status(403).json({ error: "Full JWT cannot be used for TOTP setup." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const secret = authenticator.generateSecret();
    user.totp_secret = secret;
    await user.save();

    const otpAuthUrl = authenticator.keyuri(user.email, "Sentinel", secret);
    const qrDataUrl  = await QRCode.toDataURL(otpAuthUrl);

    res.json({ secret, qrDataUrl, otpAuthUrl });
  } catch (err) {
    console.error("[totp/setup]", err);
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── POST /api/auth/totp/verify ──────────────────────────────────────────────

exports.totpVerify = async (req, res) => {
  try {
    if (!req.user.temp) {
      return res.status(403).json({ error: "Use your temp token for TOTP verification." });
    }

    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: "TOTP code is required." });

    const user = await User.findById(req.user.id);
    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: "TOTP not configured for this account." });
    }

    const isValid = authenticator.verify({ token: code, secret: user.totp_secret });
    if (!isValid) {
      return res.status(401).json({ error: "Invalid or expired TOTP code." });
    }

    user.totp_enabled = true;
    await user.save();

    // Look up Employee record so employee_id is included in the JWT
    const employee = await Employee.findOne({ user_id: user._id });
    if (employee) {
      user.employee_id = employee._id;
    }

    const token = makeJWT(user, false);

    res.json({
      token,
      user: { name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("[totp/verify]", err);
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

exports.me = async (req, res) => {
  try {
    if (req.user.temp) {
      return res.status(403).json({ error: "Complete TOTP verification first." });
    }
    const user = await User.findById(req.user.id).select("-password_hash");
    if (!user) return res.status(404).json({ error: "User not found" });

    // Try to get employee info for this user
    const employee = await Employee.findOne({ user_id: user._id }).populate("department_id");
    
    let department = null;
    if (employee && employee.department_id) {
        department = employee.department_id.department_name;
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: department
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
};

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

exports.logout = (_req, res) => {
  res.json({ message: "Logged out successfully." });
};
