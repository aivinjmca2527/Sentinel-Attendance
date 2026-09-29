/**
 * Security Module — Routes
 * -------------------------
 * Mounts security alert endpoints behind auth middleware.
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../shared/middleware/auth.middleware');
const securityController = require('./controller');

// GET /api/security/alerts/stats — open alert counts by type (for stat cards)
router.get('/alerts/stats', requireAuth, securityController.getAlertStats);

// GET /api/security/alerts — list alerts (filterable by status, alert_type, date range)
router.get('/alerts', requireAuth, securityController.getAlerts);

// PUT /api/security/alerts/:id/acknowledge — mark alert as acknowledged
router.put('/alerts/:id/acknowledge', requireAuth, securityController.acknowledgeAlert);

// PUT /api/security/alerts/:id/resolve — mark alert as resolved
router.put('/alerts/:id/resolve', requireAuth, securityController.resolveAlert);

module.exports = router;
