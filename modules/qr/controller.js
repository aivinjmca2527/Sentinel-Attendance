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
    const records = await Attendance.find({
      check_in_time: { $ne: null },
    })
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

module.exports = {
  getCurrentQR,
  getRecentScans,
  regenerateKeys,
  getSettings,
  updateSettings,
};

