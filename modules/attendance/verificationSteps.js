/**
 * Attendance Module — Verification Pipeline Steps
 * -------------------------------------------------
 * Each step is a small, independent, async function that receives a context object
 * and either returns normally (pass) or throws an error with { status, message } to reject.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ FUTURE CONTRIBUTORS: To add new verification steps (e.g. face-match),     │
 * │ define a new async function following the same signature                   │
 * │ and insert it into the checkinSteps / checkoutSteps arrays in              │
 * │ controller.js. Each step receives `ctx` and throws to reject.             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

const crypto = require('crypto');
const QRSession = require('../../shared/models/QRSession');
const Attendance = require('../../shared/models/Attendance');
const Employee = require('../../shared/models/Employee');
const Department = require('../../shared/models/Department');
const SecurityAlert = require('../../shared/models/SecurityAlert');
const { getGeofenceMode, getMaxAccuracy } = require('../../shared/config/geofence');

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

  const qrService = require('../qr/service');
  if (qrService.getSettings().qrGenerationEnabled === false) {
    const err = new Error('Attendance QR scanning is currently disabled by administrator.');
    err.status = 403;
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
    // Log expired QR alert if employee is known
    if (ctx.employee_id) {
      SecurityAlert.create({
        employee_id: ctx.employee_id,
        alert_type: 'expired_qr',
        severity: 'medium',
        message: 'Employee attempted to scan an expired QR session.',
        metadata: { qr_session_id: session._id },
      }).catch(e => console.error('[ALERT] expired_qr write failed:', e.message));
    }
    const err = new Error('QR code has expired. Please scan the current code.');
    err.status = 410;
    throw err;
  }

  // Attach session to context for downstream steps
  ctx.qrSession = session;
}

/**
 * Step 2: Verify department match.
 * - Looks up the employee's department_id
 * - Compares it against the QR session's department_id
 * - Blocks check-in if they don't match (403)
 *
 * Throws 403 for cross-department QR scans.
 */
async function verifyDepartmentMatch(ctx) {
  const { employee_id } = ctx;

  const employee = await Employee.findById(employee_id).lean();
  if (!employee) {
    const err = new Error('Employee not found.');
    err.status = 404;
    throw err;
  }

  // Attach employee to context for downstream use
  ctx.employee = employee;

  const qrDeptId = ctx.qrSession.department_id?.toString();
  const empDeptId = employee.department_id?.toString();

  if (!qrDeptId || !empDeptId) {
    // If either has no department set, skip the check (graceful fallback)
    console.warn('[Verification] Department check skipped — missing department_id on employee or QR session.');
    return;
  }

  if (qrDeptId !== empDeptId) {
    // Log a security alert for the cross-department attempt
    try {
      await SecurityAlert.create({
        employee_id,
        alert_type: 'department_mismatch',
        severity: 'high',
        message: `Employee attempted to scan QR code from a different department.`,
        metadata: {
          department_id: ctx.qrSession.department_id,
          qr_session_id: ctx.qrSession._id,
        },
      });
    } catch (alertErr) {
      console.error('[Verification] Failed to log department mismatch alert:', alertErr.message);
    }

    const err = new Error('Department mismatch: you cannot check in with another department\'s QR code.');
    err.status = 403;
    throw err;
  }
}

/**
 * Step 3: Verify no duplicate scan (check-in).
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
    SecurityAlert.create({
      employee_id,
      alert_type: 'duplicate_scan',
      severity: 'high',
      message: 'Employee attempted to check in again after already scanning today.',
      metadata: { qr_session_id: ctx.qrSession?._id },
    }).catch(e => console.error('[ALERT] duplicate_scan write failed:', e.message));
    const err = new Error('Employee has already checked in today.');
    err.status = 409;
    throw err;
  }
}

/**
 * Step 3 (checkout variant): Verify checkout preconditions.
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

/**
 * Step 4: Verify geofence.
 * - Reads latitude/longitude, accuracy_m, is_mock_location from request body
 * - Modes:
 *   - 'off': skips geofence validation entirely
 *   - 'log': logs SecurityAlert if outside radius, does NOT block
 *   - 'enforce': blocks check-in/out if outside radius (403), accuracy poor (422),
 *                or mock location (403); logs SecurityAlert for out-of-bounds attempts
 */
async function verifyGeofence(ctx) {
  const { latitude, longitude, accuracy_m, is_mock_location } = ctx.body;

  // Store location on context regardless (controller will save to attendance record)
  ctx.latitude = latitude != null ? latitude : null;
  ctx.longitude = longitude != null ? longitude : null;
  ctx.accuracy_m = accuracy_m != null ? Number(accuracy_m) : null;
  ctx.is_mock_location = is_mock_location != null ? Boolean(is_mock_location) : null;

  const mode = getGeofenceMode(ctx);
  const maxAccuracy = getMaxAccuracy(ctx);

  if (mode === 'off') {
    return;
  }

  if (mode === 'enforce') {
    if (typeof is_mock_location !== 'boolean') {
      const err = new Error('MOCK_LOCATION_FLAG_REQUIRED');
      err.status = 400;
      err.body = { error: 'MOCK_LOCATION_FLAG_REQUIRED' };
      throw err;
    }

    if (is_mock_location === true) {
      SecurityAlert.create({
        employee_id: ctx.employee_id,
        alert_type: 'mock_location',
        severity: 'critical',
        message: 'Employee scan rejected — mock/spoofed GPS location detected.',
        metadata: {
          qr_session_id: ctx.qrSession?._id,
          is_mock_location: true,
          department_id: ctx.qrSession?.department_id,
        },
      }).catch(e => console.error('[ALERT] mock_location write failed:', e.message));
      const err = new Error('MOCK_LOCATION');
      err.status = 403;
      err.body = { error: 'MOCK_LOCATION' };
      throw err;
    }

    if (accuracy_m !== undefined && accuracy_m !== null) {
      const parsedAccuracy = Number(accuracy_m);
      if (parsedAccuracy > maxAccuracy) {
        SecurityAlert.create({
          employee_id: ctx.employee_id,
          alert_type: 'low_accuracy',
          severity: 'medium',
          message: `Employee scan rejected — GPS accuracy too low (${parsedAccuracy}m, max ${maxAccuracy}m).`,
          metadata: {
            qr_session_id: ctx.qrSession?._id,
            accuracy_m: parsedAccuracy,
            department_id: ctx.qrSession?.department_id,
          },
        }).catch(e => console.error('[ALERT] low_accuracy write failed:', e.message));
        const err = new Error('ACCURACY_TOO_LOW');
        err.status = 422;
        err.body = { error: 'ACCURACY_TOO_LOW' };
        throw err;
      }
    }
  }

  if (mode === 'enforce' && (latitude == null || longitude == null)) {
    const err = new Error('Location required when geofence is enforced.');
    err.status = 400;
    err.body = { error: 'LOCATION_REQUIRED' };
    throw err;
  }

  // If no location sent by client, skip geofence check
  if (latitude == null || longitude == null) {
    return;
  }

  // Look up department geofence config
  const empDeptId = ctx.employee?.department_id || ctx.qrSession?.department_id;
  if (!empDeptId) return;

  const dept = await Department.findById(empDeptId).lean();
  if (!dept || dept.geofence_lat == null || dept.geofence_lng == null) {
    // No geofence configured for this department — skip
    return;
  }

  const distance = haversineDistance(
    latitude, longitude,
    dept.geofence_lat, dept.geofence_lng
  );

  const radius = dept.geofence_radius_m || 200;

  if (distance > radius) {
    const roundedDistance = Math.round(distance);
    console.warn(
      `[Geofence] Employee ${ctx.employee_id} is ${roundedDistance}m from ` +
      `${dept.department_name} center (limit: ${radius}m)`
    );

    try {
      await SecurityAlert.create({
        employee_id: ctx.employee_id,
        alert_type: 'geofence_violation',
        severity: 'high',
        message: `Employee scanned QR ${roundedDistance}m outside the ${dept.department_name} geofence (limit: ${radius}m).`,
        metadata: {
          latitude,
          longitude,
          department_id: empDeptId,
          distance_m: roundedDistance,
          qr_session_id: ctx.qrSession?._id,
          accuracy_m: accuracy_m != null ? Number(accuracy_m) : null,
          is_mock_location: is_mock_location != null ? Boolean(is_mock_location) : null,
        },
      });
    } catch (alertErr) {
      console.error(
        `[ALERT_WRITE_FAILURE] employee_id=${ctx.employee_id} alert_type=geofence_violation error=${alertErr.message}`
      );
    }

    if (mode === 'enforce') {
      const err = new Error('OUTSIDE_GEOFENCE');
      err.status = 403;
      err.distance_m = roundedDistance;
      err.allowed_radius_m = radius;
      err.body = {
        error: 'OUTSIDE_GEOFENCE',
        distance_m: roundedDistance,
        allowed_radius_m: radius,
      };
      throw err;
    }
  }
}

// ─── Haversine helper ───────────────────────────────────────────────────────

/**
 * Compute the distance in meters between two lat/lng points using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


/**
 * Step 0 (pre-check): Rapid Fire Scan Detection.
 * If the same employee generates > 3 SecurityAlerts within 60 seconds,
 * flag it as a brute-force / spoof attempt and block the request.
 *
 * Uses existing SecurityAlert data — no extra dependencies.
 * Throws 429 on rapid-fire detection.
 */
async function detectRapidFireScan(ctx) {
  const { employee_id } = ctx;
  if (!employee_id) return; // can't check without an ID

  const WINDOW_SECONDS = 60;
  const MAX_ALERTS = 3;
  const since = new Date(Date.now() - WINDOW_SECONDS * 1000);

  const recentCount = await SecurityAlert.countDocuments({
    employee_id,
    created_at: { $gte: since },
  });

  if (recentCount >= MAX_ALERTS) {
    // Log the rapid-fire alert itself (fire-and-forget)
    SecurityAlert.create({
      employee_id,
      alert_type: 'rapid_fire_scan',
      severity: 'critical',
      message: `Rapid-fire scan detected: ${recentCount} security alerts in the last ${WINDOW_SECONDS}s. Possible brute-force or replay attack.`,
      metadata: { scan_count: recentCount },
    }).catch(e => console.error('[ALERT] rapid_fire_scan write failed:', e.message));

    const err = new Error('Too many failed scan attempts. Please wait before trying again.');
    err.status = 429;
    err.body = { error: 'RAPID_FIRE_SCAN_BLOCKED', retry_after_seconds: WINDOW_SECONDS };
    throw err;
  }
}

module.exports = {
  runVerificationPipeline,
  detectRapidFireScan,
  verifyQrSignatureAndExpiry,
  verifyDepartmentMatch,
  verifyNoDuplicateCheckin,
  verifyCheckoutPreconditions,
  verifyGeofence,
  haversineDistance,
};
