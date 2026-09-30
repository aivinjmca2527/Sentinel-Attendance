/**
 * QR Module — Controller
 * -----------------------
 * Handles HTTP requests for the QR subsystem.
 * Generates department-scoped QR sessions on demand (lazy evaluation).
 */

const qrService = require('./service');

/**
 * GET /api/qr/current?department_id=xxx
 * Protected (manager/admin).
 * Returns the latest non-expired QRSession for the given department.
 * Generates one on demand if none is valid.
 */
async function getCurrentQR(req, res) {
  try {
    const { department_id } = req.query;
    if (!department_id) {
      return res.status(400).json({ error: 'department_id query parameter is required.' });
    }

    const session = await qrService.getOrCreateCurrentSession(department_id);
    return res.json({
      qr_session_id: session._id,
      department_id: session.department_id,
      code_value: session.code_value,
      signature: session.signature,
      expires_at: session.expires_at,
    });
  } catch (err) {
    console.error('[QR Controller] getCurrentQR error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve current QR session.' });
  }
}

/**
 * GET /api/qr/recent-scans
 * Protected (manager/admin).
 * Returns the last 10 attendance check-ins/check-outs for the kiosk log table.
 */
async function getRecentScans(req, res) {
  try {
    const Attendance = require('../../shared/models/Attendance');
    const Employee = require('../../shared/models/Employee');
    const role = (req.user?.role || '').toLowerCase();

    const filter = { check_in_time: { $ne: null } };

    if (role === 'manager') {
      const deptId = req.user?.department_id;
      if (!deptId) {
        return res.json([]);
      }
      const deptEmployees = await Employee.find({ department_id: deptId }).select('_id').lean();
      filter.employee_id = { $in: deptEmployees.map(e => e._id) };
    } else if (role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const records = await Attendance.find(filter)
      .sort({ check_in_time: -1 })
      .limit(10)
      .populate({
        path: 'employee_id',
        populate: [
          { path: 'user_id', select: 'name' },
          { path: 'department_id', select: 'department_name' },
        ],
      })
      .lean();

    const scans = records.map((r) => ({
      employee_name: r.employee_id?.user_id?.name || 'Unknown',
      department_name: r.employee_id?.department_id?.department_name || 'Unknown',
      employee_id: r.employee_id?._id,
      check_in_time: r.check_in_time,
      check_out_time: r.check_out_time,
      status: r.status,
      date: r.date,
    }));

    return res.json(scans);
  } catch (err) {
    console.error('[QR Controller] getRecentScans error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve recent scans.' });
  }
}

/**
 * POST /api/qr/regenerate-keys
 * Forces immediate rotation of security keys.
 */
async function regenerateKeys(req, res) {
  try {
    const session = await qrService.forceRotateSession();
    return res.json({
      message: 'Security keys regenerated successfully.',
      qr_session_id: session._id,
      code_value: session.code_value,
      signature: session.signature,
      expires_at: session.expires_at,
    });
  } catch (err) {
    console.error('[QR Controller] regenerateKeys error:', err.message);
    return res.status(500).json({ error: 'Failed to regenerate security keys.' });
  }
}

/**
 * GET /api/qr/settings
 */
async function getSettings(req, res) {
  try {
    return res.json(qrService.getSettings());
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch settings.' });
  }
}

/**
 * POST /api/qr/settings
 */
async function updateSettings(req, res) {
  try {
    const updated = qrService.updateSettings(req.body || {});
    return res.json({ message: 'Settings updated successfully.', settings: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
}

/**
 * GET /api/qr/kiosk-view?department_id=xxx&kiosk_key=yyy
 * Low-privilege, unauthenticated endpoint for physical kiosk display screens.
 * Validates kiosk_key against process.env.KIOSK_DISPLAY_KEY.
 * Returns 401 without revealing whether department_id is valid on auth failure.
 * Reuses the exact same underlying QR session logic as getCurrentQR.
 */
async function getKioskQR(req, res) {
  try {
    const { department_id } = req.query;
    const kiosk_key = req.query.kiosk_key || req.headers['x-kiosk-key'];
    const configuredKey = process.env.KIOSK_DISPLAY_KEY;

    // 1. Validate kiosk_key against configured environment secret
    // Do NOT validate or reveal anything about department_id if the key is invalid or missing
    if (!configuredKey || !kiosk_key || kiosk_key !== configuredKey) {
      return res.status(401).json({ error: 'Invalid or missing kiosk display key.' });
    }

    // 2. Validate department_id
    if (!department_id) {
      return res.status(400).json({ error: 'department_id query parameter is required.' });
    }

    // 3. Call same underlying QR generation/rotation logic as getCurrentQR
    const session = await qrService.getOrCreateCurrentSession(department_id);
    return res.json({
      qr_session_id: session._id,
      department_id: session.department_id,
      code_value: session.code_value,
      signature: session.signature,
      expires_at: session.expires_at,
    });
  } catch (err) {
    console.error('[QR Controller] getKioskQR error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve kiosk QR session.' });
  }
}

module.exports = {
  getCurrentQR,
  getKioskQR,
  getRecentScans,
  regenerateKeys,
  getSettings,
  updateSettings,
};

