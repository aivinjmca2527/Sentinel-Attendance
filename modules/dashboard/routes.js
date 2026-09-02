const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../shared/middleware/auth.middleware');
const dashboardController = require('./controller');

// Protect all dashboard routes for admin only
router.use(requireAuth, requireRole('admin'));

router.get('/summary', dashboardController.getSummary);
router.get('/attendance-trends', dashboardController.getAttendanceTrends);
router.get('/department-comparison', dashboardController.getDepartmentComparison);

module.exports = router;
