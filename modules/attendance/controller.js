/**
 * Attendance Module — Controller
 * --------------------------------
 * Handles check-in, check-out, and attendance record queries.
 * Uses the modular verification pipeline from verificationSteps.js.
 */

const Attendance = require('../../shared/models/Attendance');
const {
  runVerificationPipeline,
  verifyQrSignatureAndExpiry,
  verifyNoDuplicateCheckin,
  verifyCheckoutPreconditions,
} = require('./verificationSteps');

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * Check-in cutoff time in "HH:MM" 24-hour format.
 * Anything at or before this time is "on-time", after is "late".
 * Override via CHECK_IN_CUTOFF env var (e.g. "09:30").
 */
const CHECK_IN_CUTOFF = process.env.CHECK_IN_CUTOFF || '09:00';

/**
 * Standard workday length in hours.
 * Used to determine 'early-leave' status on checkout.
 * Override via STANDARD_WORK_HOURS env var.
 */
const STANDARD_WORK_HOURS = parseFloat(process.env.STANDARD_WORK_HOURS) || 8;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Return { todayStart, todayEnd } for the current calendar day (UTC). */
function getTodayRange() {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { todayStart, todayEnd };
}

/** Determine check-in status based on cutoff time. */
function getCheckinStatus(checkInTime) {
  const [cutH, cutM] = CHECK_IN_CUTOFF.split(':').map(Number);
  const h = checkInTime.getUTCHours();
  const m = checkInTime.getUTCMinutes();
  return (h < cutH || (h === cutH && m <= cutM)) ? 'on-time' : 'late';
}

/** Compute working hours (decimal) from two Date objects. */
function computeWorkingHours(checkIn, checkOut) {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
}

/** Determine checkout status. */
function getCheckoutStatus(workingHours, checkinStatus) {
  if (workingHours < STANDARD_WORK_HOURS) return 'early-leave';
  // Preserve late if they were late checking in
  if (checkinStatus === 'late') return 'late';
  return 'on-time';
}

// ─── Verification step arrays ───────────────────────────────────────────────
// FUTURE: Add verifyGeofence, verifyFaceMatch here as extra steps.
// Each step is an async function(ctx) that throws on rejection.

const checkinSteps = [
  verifyQrSignatureAndExpiry,   // checks code_value / signature / expires_at
  verifyNoDuplicateCheckin,     // checks employee doesn't already have today's record
];

const checkoutSteps = [
  verifyQrSignatureAndExpiry,   // same QR integrity check
  verifyCheckoutPreconditions,  // must have check-in, must not already have check-out
];

// ─── Route handlers ─────────────────────────────────────────────────────────

/**
 * POST /api/attendance/checkin
 * Body: { qr_session_id, code_value, signature }
 * Called by the mobile app after an employee scans the QR code.
 */
async function checkin(req, res) {
  try {
    const { todayStart, todayEnd } = getTodayRange();

    // Build the pipeline context
    // req.user is populated by auth middleware (will contain employee_id once Nandana's auth is live)
    const employee_id = req.user?.employee_id || req.body.employee_id;
    if (!employee_id) {
      return res.status(400).json({ error: 'employee_id is required.' });
    }

    const ctx = {
      body: req.body,
      employee_id,
      todayStart,
      todayEnd,
    };

    // Run the verification pipeline
    await runVerificationPipeline(checkinSteps, ctx);

    const now = new Date();
    const status = getCheckinStatus(now);

    // Create today's attendance record
    const record = new Attendance({
      employee_id,
      date: todayStart,
      check_in_time: now,
      check_in_qr_session_id: ctx.qrSession._id,
      status,
      verification_method: 'qr_only',
      // Reserved fields — not populated in this phase
      // check_in_latitude: null,
      // check_in_longitude: null,
    });

    await record.save();

    return res.status(201).json({
      message: 'Check-in successful.',
      attendance_id: record._id,
      check_in_time: record.check_in_time,
      status: record.status,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * POST /api/attendance/checkout
 * Body: { qr_session_id, code_value, signature }
 * Called by the mobile app when the employee scans to check out.
 *
 * NOTE: Records with check_in_time set but check_out_time still null
 * should read status 'incomplete' for Amina's dashboard.
 */
async function checkout(req, res) {
  try {
    const { todayStart, todayEnd } = getTodayRange();

    const employee_id = req.user?.employee_id || req.body.employee_id;
    if (!employee_id) {
      return res.status(400).json({ error: 'employee_id is required.' });
    }

    const ctx = {
      body: req.body,
      employee_id,
      todayStart,
      todayEnd,
    };

    // Run the verification pipeline
    await runVerificationPipeline(checkoutSteps, ctx);

    const record = ctx.attendanceRecord; // attached by verifyCheckoutPreconditions
    const now = new Date();

    record.check_out_time = now;
    record.check_out_qr_session_id = ctx.qrSession._id;
    // Reserved fields — not populated in this phase
    // record.check_out_latitude = null;
    // record.check_out_longitude = null;

    // Always recompute working hours and status from timestamps
    record.working_hours = computeWorkingHours(record.check_in_time, now);
    record.status = getCheckoutStatus(record.working_hours, getCheckinStatus(record.check_in_time));

    await record.save();

    return res.status(200).json({
      message: 'Check-out successful.',
      attendance_id: record._id,
      check_out_time: record.check_out_time,
      working_hours: record.working_hours,
      status: record.status,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * GET /api/attendance
 * Protected (manager/admin).
 * Query params: employee_id, date, start_date, end_date
 * Returns matching records with employee name populated.
 * Powers Daily_Attendnace_Tracking_Page.html and is available for Amina's dashboard.
 */
async function getAttendanceRecords(req, res) {
  try {
    const filter = {};
    const { employee_id, date, start_date, end_date } = req.query;

    if (employee_id) {
      filter.employee_id = employee_id;
    }

    if (date) {
      // Single day query
      const d = new Date(date);
      const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      filter.date = { $gte: dayStart, $lte: dayEnd };
    } else if (start_date || end_date) {
      // Date range query
      filter.date = {};
      if (start_date) filter.date.$gte = new Date(start_date);
      if (end_date) {
        const ed = new Date(end_date);
        filter.date.$lte = new Date(Date.UTC(ed.getUTCFullYear(), ed.getUTCMonth(), ed.getUTCDate(), 23, 59, 59, 999));
      }
    }

    const records = await Attendance.find(filter)
      .sort({ date: -1, check_in_time: -1 })
      .populate({
        path: 'employee_id',
        populate: { path: 'user_id', select: 'name email' },
      })
      .lean();

    // Map records to include employee name at top level for convenience
    const result = records.map((r) => ({
      _id: r._id,
      employee_id: r.employee_id?._id,
      employee_name: r.employee_id?.user_id?.name || 'Unknown',
      employee_email: r.employee_id?.user_id?.email || '',
      designation: r.employee_id?.designation || '',
      date: r.date,
      check_in_time: r.check_in_time,
      check_out_time: r.check_out_time,
      working_hours: r.working_hours,
      // NOTE: Records with check_in_time set but check_out_time still null
      // should read status 'incomplete' for Amina's dashboard.
      status: (r.check_in_time && !r.check_out_time) ? 'incomplete' : r.status,
      verification_method: r.verification_method,
    }));

    return res.json(result);
  } catch (err) {
    console.error('[Attendance Controller] getAttendanceRecords error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve attendance records.' });
  }
}

module.exports = {
  checkin,
  checkout,
  getAttendanceRecords,
};
