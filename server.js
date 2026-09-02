/**
 * Sentinel Attendance — Express Server (Shared Scaffold)
 * Run: node server.js  (or npm start / npm run dev)
 */

const express   = require("express");
const cors      = require("cors");
const path      = require("path");
const rateLimit = require("express-rate-limit");

const PORT = process.env.PORT || 3000;

// ─── DB init first ───────────────────────────────────────────────────────────

const { initPromise } = require("./shared/config/db");

// ─── Module routes ───────────────────────────────────────────────────────────

const authRoutes = require("./modules/auth/routes");                          // Melbin
const { employeeRouter, departmentRouter } = require("./modules/employees/routes"); // Melbin
const attendanceRoutes = require('./modules/attendance/routes');               // Aivin
const qrRoutes         = require('./modules/qr/routes');                      // Aivin
// const dashboardRoutes  = require('./modules/dashboard/routes');            // Amina
// const reportRoutes     = require('./modules/reports/routes');              // Amina
// const leaveRoutes      = require('./modules/leave/routes');                // Nandana

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express();

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// Serve static frontend files (login, employees, dashboard, TOTP pages, etc.)
app.use(express.static(path.join(__dirname)));

// Serve Templates
app.use("/Templates", express.static(path.join(__dirname, "Templates")));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── API Routes ──────────────────────────────────────────────────────────────

app.use("/api/auth",        loginLimiter, authRoutes);        // Melbin
app.use("/api/employees",   employeeRouter);                  // Melbin
app.use("/api/departments", departmentRouter);                // Melbin
app.use('/api/attendance',  attendanceRoutes);                // Aivin
app.use('/api/qr',          qrRoutes);                       // Aivin
// app.use('/api/dashboard',  dashboardRoutes);                // Amina
// app.use('/api/reports',    reportRoutes);                   // Amina
// app.use('/api/leave',      leaveRoutes);                    // Nandana

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
    console.log(`   Open http://localhost:${PORT} in your browser to use the app.\n`);
  });
}).catch((err) => {
  console.error("[FATAL] DB init failed:", err.message);
  process.exit(1);
});
