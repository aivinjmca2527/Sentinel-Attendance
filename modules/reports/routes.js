const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../shared/middleware/auth.middleware');
const reportsController = require('./controller');

// Protect all reports routes for admin only
router.use(requireAuth, requireRole('admin'));

router.get('/organisation', reportsController.getOrganisationReport);

module.exports = router;
