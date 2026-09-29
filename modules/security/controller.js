/**
 * Security Module — Controller
 * ------------------------------
 * Handles security alert queries, acknowledgment, and resolution.
 */

const SecurityAlert = require('../../shared/models/SecurityAlert');

/**
 * GET /api/security/alerts
 * Protected (admin).
 * Query params: status, alert_type, start_date, end_date, limit
 * Returns security alerts with employee info populated.
 */
async function getAlerts(req, res) {
  try {
    const filter = {};
    const { status, alert_type, start_date, end_date, limit } = req.query;

    if (status) filter.status = status;
    if (alert_type) filter.alert_type = alert_type;

    if (start_date || end_date) {
      filter.created_at = {};
      if (start_date) filter.created_at.$gte = new Date(start_date);
      if (end_date) {
        const ed = new Date(end_date);
        ed.setHours(23, 59, 59, 999);
        filter.created_at.$lte = ed;
      }
    }

    const maxResults = Math.min(parseInt(limit) || 50, 200);

    const alerts = await SecurityAlert.find(filter)
      .sort({ created_at: -1 })
      .limit(maxResults)
      .populate({
        path: 'employee_id',
        populate: [
          { path: 'user_id', select: 'name email' },
          { path: 'department_id', select: 'department_name' },
        ],
      })
      .lean();

    const result = alerts.map((a) => ({
      _id: a._id,
      employee_name: a.employee_id?.user_id?.name || 'Unknown',
      employee_email: a.employee_id?.user_id?.email || '',
      department_name: a.employee_id?.department_id?.department_name || 'Unknown',
      alert_type: a.alert_type,
      severity: a.severity,
      message: a.message,
      metadata: a.metadata,
      status: a.status,
      created_at: a.created_at,
    }));

    return res.json(result);
  } catch (err) {
    console.error('[Security Controller] getAlerts error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve security alerts.' });
  }
}

/**
 * GET /api/security/alerts/stats
 * Protected (admin).
 * Returns counts of open alerts grouped by alert_type plus totals.
 */
async function getAlertStats(req, res) {
  try {
    const [byType, byStatus] = await Promise.all([
      SecurityAlert.aggregate([
        { $match: { status: 'open' } },
        { $group: { _id: '$alert_type', count: { $sum: 1 } } },
      ]),
      SecurityAlert.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const typeMap = {};
    byType.forEach((t) => { typeMap[t._id] = t.count; });

    const statusMap = {};
    byStatus.forEach((s) => { statusMap[s._id] = s.count; });

    return res.json({
      open_by_type: typeMap,
      by_status: statusMap,
      total_open: Object.values(typeMap).reduce((sum, v) => sum + v, 0),
    });
  } catch (err) {
    console.error('[Security Controller] getAlertStats error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve alert stats.' });
  }
}

/**
 * PUT /api/security/alerts/:id/acknowledge
 * Protected (admin).
 * Mark an alert as acknowledged.
 */
async function acknowledgeAlert(req, res) {
  try {
    const alert = await SecurityAlert.findByIdAndUpdate(
      req.params.id,
      { status: 'acknowledged' },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    return res.json({ message: 'Alert acknowledged.', alert });
  } catch (err) {
    console.error('[Security Controller] acknowledgeAlert error:', err.message);
    return res.status(500).json({ error: 'Failed to acknowledge alert.' });
  }
}

/**
 * PUT /api/security/alerts/:id/resolve
 * Protected (admin).
 * Mark an alert as resolved.
 */
async function resolveAlert(req, res) {
  try {
    const alert = await SecurityAlert.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved' },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    return res.json({ message: 'Alert resolved.', alert });
  } catch (err) {
    console.error('[Security Controller] resolveAlert error:', err.message);
    return res.status(500).json({ error: 'Failed to resolve alert.' });
  }
}

module.exports = {
  getAlerts,
  getAlertStats,
  acknowledgeAlert,
  resolveAlert,
};
