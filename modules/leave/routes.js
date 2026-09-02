/**
 * Leave Management Routes
 * =======================
 * POST   /api/leave              – Submit a new leave request (any authenticated employee).
 * GET    /api/leave              – List leave requests (role-based filtering).
 * GET    /api/leave/my           – Employee's own leave requests.
 * GET    /api/leave/requests     – Admin/manager listing with filters.
 * GET    /api/leave/balance      – Employee's leave balance.
 * GET    /api/leave/stats        – Admin/manager summary counts.
 * GET    /api/leave/:id          – Single leave request detail.
 * PATCH  /api/leave/:id/cancel   – Employee cancels own pending request.
 * PUT    /api/leave/:id/approve  – Approve a pending request (manager / admin).
 * PATCH  /api/leave/:id/approve  – Approve (PATCH alias).
 * PUT    /api/leave/:id/deny     – Deny a pending request   (manager / admin).
 * PATCH  /api/leave/:id/deny     – Deny (PATCH alias).
 * PATCH  /api/leave/:id/reject   – Reject alias for deny.
 */

const express = require('express');
const router  = express.Router();

const { authenticate, requireRole } = require('./authHelpers');
const {
  submitLeave,
  getLeaveRequests,
  getMyLeaveRequests,
  getAdminLeaveRequests,
  getLeaveBalance,
  getLeaveStats,
  getLeaveById,
  approveLeave,
  denyLeave,
  cancelLeave,
} = require('./controller');

// ── Static routes (must come before :id) ──────────────────────────
// Employee submission (mobile app calls this)
router.post('/', authenticate, submitLeave);

// Role-based listing (legacy — works for all roles)
router.get('/', authenticate, getLeaveRequests);

// Employee's own requests
router.get('/my', authenticate, getMyLeaveRequests);

// Admin/manager listing with filters
router.get('/requests', authenticate, requireRole(['manager', 'admin']), getAdminLeaveRequests);

// Employee's leave balance
router.get('/balance', authenticate, getLeaveBalance);

// Admin/manager stats summary
router.get('/stats', authenticate, requireRole(['manager', 'admin']), getLeaveStats);

// ── Parameterized routes ──────────────────────────────────────────
// Single leave request detail
router.get('/:id', authenticate, getLeaveById);

// Employee cancellation
router.patch('/:id/cancel', authenticate, cancelLeave);

// Manager / Admin approval (PUT + PATCH)
router.put('/:id/approve', authenticate, requireRole(['manager', 'admin']), approveLeave);
router.patch('/:id/approve', authenticate, requireRole(['manager', 'admin']), approveLeave);

// Manager / Admin denial (PUT + PATCH)
router.put('/:id/deny', authenticate, requireRole(['manager', 'admin']), denyLeave);
router.patch('/:id/deny', authenticate, requireRole(['manager', 'admin']), denyLeave);

// Reject alias → same as deny
router.patch('/:id/reject', authenticate, requireRole(['manager', 'admin']), denyLeave);

module.exports = router;
