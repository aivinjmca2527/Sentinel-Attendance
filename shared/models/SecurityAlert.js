const mongoose = require('mongoose');

const securityAlertSchema = new mongoose.Schema({
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  alert_type: {
    type: String,
    enum: ['geofence_violation', 'department_mismatch', 'expired_qr', 'duplicate_scan', 'mock_location', 'low_accuracy', 'rapid_fire_scan', 'qr_disabled_scan'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  message: { type: String, required: true },
  metadata: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    department_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    distance_m: { type: Number, default: null },
    qr_session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'QRSession', default: null },
    accuracy_m: { type: Number, default: null },
    is_mock_location: { type: Boolean, default: null },
    scan_count: { type: Number, default: null },
  },
  status: {
    type: String,
    enum: ['open', 'acknowledged', 'resolved'],
    default: 'open'
  },
  created_at: { type: Date, default: Date.now }
});

securityAlertSchema.index({ created_at: -1 });
securityAlertSchema.index({ status: 1, alert_type: 1 });

module.exports = mongoose.model('SecurityAlert', securityAlertSchema);
