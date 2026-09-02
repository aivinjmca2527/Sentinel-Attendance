/**
 * Attendance Module — Routes
 * ---------------------------
 * Mounts attendance endpoints behind auth middleware.
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../shared/middleware/auth.middleware');
const attendanceController = require('./controller');

// POST /api/attendance/checkin  — employee scans QR to check in (mobile app)
router.post('/checkin', requireAuth, attendanceController.checkin);

// POST /api/attendance/checkout — employee scans QR to check out (mobile app)
router.post('/checkout', requireAuth, attendanceController.checkout);

// GET  /api/attendance          — manager/admin queries attendance records
router.get('/', requireAuth, attendanceController.getAttendanceRecords);

module.exports = router;
