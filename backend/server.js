/**
 * Sentinel Attendance — Express Server
 * Run: node server.js  (or npm start)
 */

const express    = require("express");
const cors       = require("cors");
const rateLimit  = require("express-rate-limit");

const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "sentinel_dev_secret_change_in_production";

// Export JWT_SECRET before requiring routes (routes import it)
module.exports.JWT_SECRET = JWT_SECRET;

// ─── DB init first ───────────────────────────────────────────────────────────

const { initPromise } = require("./db");

// ─── Routes ──────────────────────────────────────────────────────────────────

const authRoutes       = require("./routes/auth");
const employeeRoutes   = require("./routes/employees");
const departmentRoutes = require("./routes/departments");

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express();

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── API Routes ──────────────────────────────────────────────────────────────

app.use("/api/auth",        loginLimiter, authRoutes);
app.use("/api/employees",   employeeRoutes);
app.use("/api/departments", departmentRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Internal server error." });
});

// ─── Start after DB is ready ─────────────────────────────────────────────────

initPromise.then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅ Sentinel API running → http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Open index.html in your browser to use the app.\n`);
  });
}).catch((err) => {
  console.error("[FATAL] DB init failed:", err.message);
  process.exit(1);
});
