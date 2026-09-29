/**
 * QR Module — Routes
 * -------------------
 * Mounts QR endpoints behind auth middleware.
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../shared/middleware/auth.middleware');
const qrController = require('./controller');

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

