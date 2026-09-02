/**
 * QR Module — Controller
 * -----------------------
 * Handles HTTP requests for the QR subsystem.
 * Starts the background rotation loop on module load.
 */

const qrService = require('./service');

// Start the background rotation as soon as this module is required
// (which happens when server.js mounts the QR routes).
qrService.startRotationLoop();

/**
 * GET /api/qr/current
 * Protected (manager/admin).
 * Returns the latest non-expired QRSession.
 * Generates one on demand if none is valid.
 */
async function getCurrentQR(req, res) {
  try {
    const session = await qrService.getOrCreateCurrentSession();
    return res.json({
      qr_session_id: session._id,
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
        populate: { path: 'user_id', select: 'name' },
      })
      .lean();

    const scans = records.map((r) => ({
      employee_name: r.employee_id?.user_id?.name || 'Unknown',
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

module.exports = {
  getCurrentQR,
  getRecentScans,
};
