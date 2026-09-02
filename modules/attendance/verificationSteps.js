/**
 * Attendance Module — Verification Pipeline Steps
 * -------------------------------------------------
 * Each step is a small, independent, async function that receives a context object
 * and either returns normally (pass) or throws an error with { status, message } to reject.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ FUTURE CONTRIBUTORS: To add new verification steps (e.g. geofencing,      │
 * │ face-match), define a new async function following the same signature      │
 * │ and insert it into the checkinSteps / checkoutSteps arrays in              │
 * │ controller.js. Each step receives `ctx` and throws to reject.             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

const crypto = require('crypto');
const QRSession = require('../../shared/models/QRSession');
const Attendance = require('../../shared/models/Attendance');

const QR_SIGNING_SECRET = process.env.QR_SIGNING_SECRET || 'default-dev-secret';

// ─── Pipeline runner ────────────────────────────────────────────────────────

/**
 * Run an ordered list of verification steps against a shared context.
 * The first step that throws stops the pipeline.
 *
 * @param {Function[]} steps - Array of async functions
 * @param {Object} ctx - Shared context object (request data, employee info, etc.)
 */
async function runVerificationPipeline(steps, ctx) {
  for (const step of steps) {
    await step(ctx);
  }
}

// ─── Verification steps ─────────────────────────────────────────────────────

/**
 * Step 1: Verify QR signature and expiry.
 * - Looks up the QRSession by qr_session_id
 * - Confirms code_value & signature match exactly
 * - Confirms the session has not expired
 *
 * Throws 401 for invalid/tampered data, 410 for expired codes.
 */
async function verifyQrSignatureAndExpiry(ctx) {
  const { qr_session_id, code_value, signature } = ctx.body;

  if (!qr_session_id || !code_value || !signature) {
    const err = new Error('Missing required fields: qr_session_id, code_value, signature.');
    err.status = 400;
    throw err;
  }

  // Look up the stored session
  const session = await QRSession.findById(qr_session_id).lean();
  if (!session) {
    const err = new Error('QR session not found.');
    err.status = 401;
    throw err;
  }

  // Verify code_value matches
  if (session.code_value !== code_value) {
    const err = new Error('QR code_value does not match stored session.');
    err.status = 401;
    throw err;
  }

  // Re-compute expected signature and compare
  const expectedSignature = crypto
    .createHmac('sha256', QR_SIGNING_SECRET)
    .update(code_value)
    .digest('hex');

  if (signature !== expectedSignature || signature !== session.signature) {
    const err = new Error('Invalid QR signature — possible tampering detected.');
    err.status = 401;
    throw err;
  }

  // Check expiry
  if (new Date() > new Date(session.expires_at)) {
    const err = new Error('QR code has expired. Please scan the current code.');
    err.status = 410;
    throw err;
  }

  // Attach session to context for downstream steps
  ctx.qrSession = session;
}

/**
 * Step 2: Verify no duplicate scan (check-in).
 * Ensures the employee does not already have a check_in_time for today.
 *
 * Throws 409 on duplicate.
 */
async function verifyNoDuplicateCheckin(ctx) {
  const { employee_id, todayStart, todayEnd } = ctx;

  const existing = await Attendance.findOne({
    employee_id,
    date: { $gte: todayStart, $lte: todayEnd },
    check_in_time: { $ne: null },
  }).lean();

  if (existing) {
    const err = new Error('Employee has already checked in today.');
    err.status = 409;
    throw err;
  }
}

/**
 * Step 2 (checkout variant): Verify checkout preconditions.
 * - Employee must have a check_in_time for today (can't check out without checking in)
 * - Employee must NOT already have a check_out_time
 *
 * Attaches ctx.attendanceRecord on success.
 */
async function verifyCheckoutPreconditions(ctx) {
  const { employee_id, todayStart, todayEnd } = ctx;

  const record = await Attendance.findOne({
    employee_id,
    date: { $gte: todayStart, $lte: todayEnd },
  });

  if (!record || !record.check_in_time) {
    const err = new Error('No check-in record found for today. Cannot check out.');
    err.status = 400;
    throw err;
  }

  if (record.check_out_time) {
    const err = new Error('Employee has already checked out today.');
    err.status = 409;
    throw err;
  }

  ctx.attendanceRecord = record;
}

module.exports = {
  runVerificationPipeline,
  verifyQrSignatureAndExpiry,
  verifyNoDuplicateCheckin,
  verifyCheckoutPreconditions,
};
