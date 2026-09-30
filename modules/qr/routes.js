/**
 * QR Module — Routes
 * -------------------
 * Mounts QR endpoints behind auth middleware.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../../shared/middleware/auth.middleware');
const qrController = require('./controller');

// Rate limiting for unauthenticated kiosk display endpoint.
// Reuses the express-rate-limit pattern used in server.js.
// Default allows steady 5s kiosk polling (~180 req / 15m) while blocking rapid abuse.
const kioskLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 300,
  message: { error: 'Too many kiosk display requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/qr/kiosk-view — unauthenticated low-privilege QR view for physical kiosks (shared secret)
router.get('/kiosk-view', kioskLimiter, qrController.getKioskQR);

// GET /api/qr/current — returns the latest non-expired QR code (manager/admin)
router.get('/current', requireAuth, qrController.getCurrentQR);

// GET /api/qr/recent-scans — returns last 10 check-in/check-out events (manager/admin)
router.get('/recent-scans', requireAuth, qrController.getRecentScans);

// POST /api/qr/regenerate-keys — force regenerate security keys
router.post('/regenerate-keys', requireAuth, qrController.regenerateKeys);

// GET /api/qr/settings & POST /api/qr/settings — get and update security settings
router.get('/settings', requireAuth, qrController.getSettings);
router.post('/settings', requireAuth, qrController.updateSettings);

module.exports = router;

