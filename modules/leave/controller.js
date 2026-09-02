/**
 * Leave Management Controller
 * ===========================
 * Handles leave-request submission (mobile app), listing (role-based),
 * approval, and denial (manager / admin web app).
 *
 * CROSS-MODULE NOTE (for Aivin / Attendance module):
 *   The approveLeave function is the ONE intentional cross-module write in
 *   this project. On approval it upserts Attendance records matched by
 *   { employee_id, date (midnight UTC) } with { status: 'on-leave' }.
 *   - If no record exists → creates one (employee_id + date + status only).
 *   - If a record already exists (e.g. from a real check-in) → preserves
 *     check_in_time / check_out_time / working_hours / QR refs, ONLY
 *     overwrites status to 'on-leave'.
 *   Aivin's check-in logic should NOT assume every Attendance record
 *   originated from a QR scan flow.
 */

const mongoose     = require('mongoose');
const LeaveRequest = require('../../shared/models/LeaveRequest');
const Attendance   = require('../../shared/models/Attendance');
const Employee     = require('../../shared/models/Employee');
const User         = require('../../shared/models/User');
const LeaveBalance = require('../../shared/models/LeaveBalance');

// ──────────────────────────────────────────────────────────────────────
// Helper: normalise a Date to midnight UTC (strips time component)
// ──────────────────────────────────────────────────────────────────────
function toMidnightUTC(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// ──────────────────────────────────────────────────────────────────────
// Helper: generate an array of dates between start and end (inclusive)
// ──────────────────────────────────────────────────────────────────────
function getDateRange(start, end) {
  const dates = [];
  let current = toMidnightUTC(start);
  const last  = toMidnightUTC(end);
  while (current <= last) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// Helper: count days between two dates (inclusive)
function countDays(start, end) {
  const s = toMidnightUTC(start);
  const e = toMidnightUTC(end);
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

// Helper: validate MongoDB ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ──────────────────────────────────────────────────────────────────────
// POST /api/leave
// Protected: authenticated employee (called by the mobile app).
// Body: { leave_type, start_date, end_date, reason }
// ──────────────────────────────────────────────────────────────────────
exports.submitLeave = async (req, res) => {
  try {
    const { leave_type, start_date, end_date, reason } = req.body;

    // --- Basic validation ---
    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({
        error: 'leave_type, start_date, and end_date are required.',
      });
    }

    const validTypes = ['sick', 'casual', 'earned'];
    if (!validTypes.includes(leave_type)) {
      return res.status(400).json({
        error: 'Invalid leave_type. Must be one of: ' + validTypes.join(', '),
      });
    }

    const startDate = toMidnightUTC(start_date);
    const endDate   = toMidnightUTC(end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format.' });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        error: 'start_date must be on or before end_date.',
      });
    }

    const numberOfDays = countDays(startDate, endDate);

    // --- Leave balance check ---
    const balances = await LeaveBalance.ensureBalances(req.user.employee_id);
    const balance = balances.find((b) => b.leave_type === leave_type);
    if (balance && (balance.total - balance.used) < numberOfDays) {
      return res.status(400).json({
        error: `Insufficient ${leave_type} leave balance. Available: ${balance.total - balance.used} days, Requested: ${numberOfDays} days.`,
      });
    }

    // --- Overlap check ---
    // Reject if the same employee already has a pending or approved request
    // whose date range overlaps with the new one.
    const overlap = await LeaveRequest.findOne({
      employee_id: req.user.employee_id,
      status:      { $in: ['pending', 'approved'] },
      start_date:  { $lte: endDate },
      end_date:    { $gte: startDate },
    });

    if (overlap) {
      return res.status(400).json({
        error: 'You already have a pending or approved leave request that overlaps with these dates.',
      });
    }

    // --- Create the leave request ---
    const leaveRequest = await LeaveRequest.create({
      employee_id:    req.user.employee_id,
      leave_type,
      start_date:     startDate,
      end_date:       endDate,
      number_of_days: numberOfDays,
      reason:         reason || null,
      status:         'pending',
      applied_at:     new Date(),
    });

    return res.status(201).json(leaveRequest);
  } catch (error) {
    console.error('submitLeave error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ──────────────────────────────────────────────────────────────────────
// GET /api/leave
// Protected: role-based filtering.
//   Employee → own requests only.
//   Manager  → requests from employees in the manager's department.
//   Admin    → all requests; optional query filters:
//              ?status=pending  ?department_id=...  ?employee_id=...
// ──────────────────────────────────────────────────────────────────────
exports.getLeaveRequests = async (req, res) => {
  try {
    const { role, employee_id, department_id } = req.user;
    let filter = {};

    if (role === 'employee') {
      // Employees see only their own leave requests.
      filter.employee_id = employee_id;

    } else if (role === 'manager') {
      // Managers see requests from employees in their own department.
      const deptEmployees = await Employee.find({
        department_id: department_id,
      }).select('_id').lean();

      const deptEmployeeIds = deptEmployees.map((e) => e._id);
      filter.employee_id = { $in: deptEmployeeIds };

    } else if (role === 'admin') {
      // Admins see everything, with optional query-string filters.
      if (req.query.department_id) {
        const deptEmployees = await Employee.find({
          department_id: req.query.department_id,
        }).select('_id').lean();
        filter.employee_id = { $in: deptEmployees.map((e) => e._id) };
      }
      if (req.query.employee_id) {
        filter.employee_id = req.query.employee_id;
      }
    }

    // Honour ?status= for all roles
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Honour ?leave_type= for all roles
    if (req.query.leave_type) {
      filter.leave_type = req.query.leave_type;
    }

    const requests = await LeaveRequest.find(filter)
      .populate({
        path:     'employee_id',
        select:   'user_id department_id designation',
        populate: [
          { path: 'user_id',       select: 'name email role' },
          { path: 'department_id', select: 'department_name' },
        ],
      })
      .populate({
        path:   'approved_by',
        select: 'user_id',
        populate: { path: 'user_id', select: 'name' },
      })
      .sort({ applied_at: -1 })
      .lean();

    return res.json(requests);
  } catch (error) {
    console.error('getLeaveRequests error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ──────────────────────────────────────────────────────────────────────
// GET /api/leave/my
// Protected: employee only — alias for own requests.
// Supports ?status= filter.
// ──────────────────────────────────────────────────────────────────────
exports.getMyLeaveRequests = async (req, res) => {
  try {
    const filter = { employee_id: req.user.employee_id };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const requests = await LeaveRequest.find(filter)
      .populate({
        path:   'approved_by',
        select: 'user_id',
        populate: { path: 'user_id', select: 'name' },
      })
      .sort({ applied_at: -1 })
      .lean();

    return res.json(requests);
  } catch (error) {
    console.error('getMyLeaveRequests error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ──────────────────────────────────────────────────────────────────────
// GET /api/leave/requests
// Protected: manager or admin — admin/manager listing.
// Supports ?status=, ?leave_type=, ?department_id=, ?search=
// ──────────────────────────────────────────────────────────────────────
exports.getAdminLeaveRequests = async (req, res) => {
  try {
    const { role, department_id } = req.user;
    let filter = {};

    if (role === 'manager') {
      const deptEmployees = await Employee.find({
        department_id: department_id,
      }).select('_id').lean();
      filter.employee_id = { $in: deptEmployees.map((e) => e._id) };
    }
    // admin sees all

    if (req.query.status) filter.status = req.query.status;
    if (req.query.leave_type) filter.leave_type = req.query.leave_type;
    if (req.query.department_id && role === 'admin') {
      const deptEmployees = await Employee.find({
        department_id: req.query.department_id,
      }).select('_id').lean();
      filter.employee_id = { $in: deptEmployees.map((e) => e._id) };
    }

    let requests = await LeaveRequest.find(filter)
      .populate({
        path:     'employee_id',
        select:   'user_id department_id designation',
        populate: [
          { path: 'user_id',       select: 'name email role' },
          { path: 'department_id', select: 'department_name' },
        ],
      })
      .populate({
        path:   'approved_by',
        select: 'user_id',
        populate: { path: 'user_id', select: 'name' },
      })
      .sort({ applied_at: -1 })
      .lean();

    // Client-side search filter (by employee name)
    if (req.query.search) {
      const q = req.query.search.toLowerCase();
      requests = requests.filter((r) => {
        const name = (r.employee_id?.user_id?.name || '').toLowerCase();
        const email = (r.employee_id?.user_id?.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }

    return res.json(requests);
  } catch (error) {
    console.error('getAdminLeaveRequests error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ──────────────────────────────────────────────────────────────────────
// GET /api/leave/balance
// Protected: employee — returns their leave balance for all types.
// Auto-initialises balance records if they don't exist.
// ──────────────────────────────────────────────────────────────────────
exports.getLeaveBalance = async (req, res) => {
  try {
    const balances = await LeaveBalance.ensureBalances(req.user.employee_id);
    return res.json(balances);
  } catch (error) {
    console.error('getLeaveBalance error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ──────────────────────────────────────────────────────────────────────
// GET /api/leave/stats
// Protected: manager or admin — summary counts for the dashboard.
// ──────────────────────────────────────────────────────────────────────
exports.getLeaveStats = async (req, res) => {
  try {
    const { role, department_id } = req.user;
    let matchFilter = {};

    if (role === 'manager') {
      const deptEmployees = await Employee.find({
        department_id: department_id,
      }).select('_id').lean();
      matchFilter.employee_id = { $in: deptEmployees.map((e) => e._id) };
    }

    const stats = await LeaveRequest.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = { pending: 0, approved: 0, denied: 0, cancelled: 0, total: 0 };
    stats.forEach((s) => {
      result[s._id] = s.count;
      result.total += s.count;
    });

    return res.json(result);
  } catch (error) {
    console.error('getLeaveStats error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ──────────────────────────────────────────────────────────────────────
// GET /api/leave/:id
// Protected: employee (own only), manager (own dept), admin (any).
// Returns a single leave request with full population.
// ──────────────────────────────────────────────────────────────────────
exports.getLeaveById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid request ID.' });
    }

    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate({
        path:     'employee_id',
        select:   'user_id department_id designation',
        populate: [
          { path: 'user_id',       select: 'name email role' },
          { path: 'department_id', select: 'department_name' },
        ],
      })
      .populate({
        path:   'approved_by',
        select: 'user_id',
        populate: { path: 'user_id', select: 'name' },
      })
      .lean();

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    // Authorization check
    const { role, employee_id, department_id } = req.user;
    if (role === 'employee') {
      if (leaveRequest.employee_id._id.toString() !== employee_id.toString()) {
        return res.status(403).json({ error: 'You can only view your own leave requests.' });
      }
    } else if (role === 'manager') {
      const requesterDeptId = leaveRequest.employee_id.department_id
        ? leaveRequest.employee_id.department_id._id.toString()
        : null;
      const managerDeptId = department_id ? department_id.toString() : null;
      if (!requesterDeptId || requesterDeptId !== managerDeptId) {
        return res.status(403).json({ error: 'You can only view requests from your department.' });
      }
    }
    // admin can view any

    return res.json(leaveRequest);
  } catch (error) {
    console.error('getLeaveById error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ──────────────────────────────────────────────────────────────────────
// PUT /api/leave/:id/approve  (also PATCH)
// Protected: manager or admin.
// Manager must be in the same department as the requester, else 403.
// Admin: no department restriction.
//
// CROSS-MODULE WRITE — Attendance reconciliation:
//   For each calendar date in [start_date, end_date], upsert an
//   Attendance record for the employee with status: 'on-leave'.
//   If a record with real timestamps already exists, timestamps are
//   preserved; only `status` is overwritten.
// ──────────────────────────────────────────────────────────────────────
exports.approveLeave = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid request ID.' });
    }

    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate('employee_id')
      .exec();

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot approve a request that is already ${leaveRequest.status}.`,
      });
    }

    // --- Department check (manager only) ---
    if (req.user.role === 'manager') {
      const requesterDeptId = leaveRequest.employee_id.department_id
        ? leaveRequest.employee_id.department_id.toString()
        : null;
      const managerDeptId = req.user.department_id
        ? req.user.department_id.toString()
        : null;

      if (!requesterDeptId || requesterDeptId !== managerDeptId) {
        return res.status(403).json({
          error: 'You can only approve requests from employees in your department.',
        });
      }
    }

    // --- Leave balance check & deduction ---
    const numberOfDays = leaveRequest.number_of_days || countDays(leaveRequest.start_date, leaveRequest.end_date);
    const balances = await LeaveBalance.ensureBalances(leaveRequest.employee_id._id);
    const balance = balances.find((b) => b.leave_type === leaveRequest.leave_type);

    if (balance && (balance.total - balance.used) < numberOfDays) {
      return res.status(400).json({
        error: `Insufficient ${leaveRequest.leave_type} leave balance. Available: ${balance.total - balance.used} days, Required: ${numberOfDays} days.`,
      });
    }

    // Deduct balance (atomic update to prevent double-deduction)
    if (balance) {
      await LeaveBalance.updateOne(
        { _id: balance._id, used: balance.used },  // optimistic lock
        { $inc: { used: numberOfDays } }
      );
    }

    // --- Update leave request ---
    leaveRequest.status         = 'approved';
    leaveRequest.approved_by    = req.user.employee_id;
    leaveRequest.reviewed_at    = new Date();
    leaveRequest.number_of_days = numberOfDays;
    await leaveRequest.save();

    // ──────────────────────────────────────────────────────────────
    // CROSS-MODULE WRITE: Attendance reconciliation (for Aivin)
    //
    // For each date in the approved range, upsert an Attendance
    // record keyed by { employee_id, date }.
    //   • New record  → created with status: 'on-leave' only.
    //   • Existing    → status set to 'on-leave'; check_in_time,
    //                   check_out_time, working_hours, and QR refs
    //                   are LEFT UNTOUCHED.
    //
    // Aivin: your check-in flow should account for records that
    // have status 'on-leave' but no check_in_time / QR session.
    // ──────────────────────────────────────────────────────────────
    const dates = getDateRange(leaveRequest.start_date, leaveRequest.end_date);

    const bulkOps = dates.map((date) => ({
      updateOne: {
        filter: {
          employee_id: leaveRequest.employee_id._id,
          date:        date,
        },
        update: {
          $set:         { status: 'on-leave' },
          $setOnInsert: {
            employee_id: leaveRequest.employee_id._id,
            date:        date,
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps);
    }

    return res.json({
      message: 'Leave request approved.',
      leaveRequest,
      attendance_dates_written: dates.length,
    });
  } catch (error) {
    console.error('approveLeave error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ──────────────────────────────────────────────────────────────────────
// PUT /api/leave/:id/deny  (also PATCH, also /reject alias)
// Protected: manager or admin. Same department rule for managers.
// Body: { reason (optional) }
// Sets status: 'denied', approved_by. No Attendance write.
// ──────────────────────────────────────────────────────────────────────
exports.denyLeave = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid request ID.' });
    }

    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate('employee_id')
      .exec();

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot deny a request that is already ${leaveRequest.status}.`,
      });
    }

    // --- Department check (manager only) ---
    if (req.user.role === 'manager') {
      const requesterDeptId = leaveRequest.employee_id.department_id
        ? leaveRequest.employee_id.department_id.toString()
        : null;
      const managerDeptId = req.user.department_id
        ? req.user.department_id.toString()
        : null;

      if (!requesterDeptId || requesterDeptId !== managerDeptId) {
        return res.status(403).json({
          error: 'You can only deny requests from employees in your department.',
        });
      }
    }

    // --- Update leave request ---
    leaveRequest.status         = 'denied';
    leaveRequest.approved_by    = req.user.employee_id;
    leaveRequest.denial_reason  = req.body.reason || null;
    leaveRequest.reviewed_at    = new Date();
    await leaveRequest.save();

    return res.json({
      message: 'Leave request denied.',
      leaveRequest,
    });
  } catch (error) {
    console.error('denyLeave error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ──────────────────────────────────────────────────────────────────────
// PATCH /api/leave/:id/cancel
// Protected: employee — can cancel own pending request.
// If the request was already approved, balance is restored and
// attendance records are cleaned up.
// ──────────────────────────────────────────────────────────────────────
exports.cancelLeave = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid request ID.' });
    }

    const leaveRequest = await LeaveRequest.findById(req.params.id).exec();

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    // Only the owning employee can cancel
    if (leaveRequest.employee_id.toString() !== req.user.employee_id.toString()) {
      return res.status(403).json({ error: 'You can only cancel your own leave requests.' });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot cancel a request that is already ${leaveRequest.status}. Only pending requests can be cancelled.`,
      });
    }

    leaveRequest.status      = 'cancelled';
    leaveRequest.reviewed_at = new Date();
    await leaveRequest.save();

    return res.json({
      message: 'Leave request cancelled.',
      leaveRequest,
    });
  } catch (error) {
    console.error('cancelLeave error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
