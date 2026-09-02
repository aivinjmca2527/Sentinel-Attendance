const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  check_in_time: { type: Date, default: null },
  check_out_time: { type: Date, default: null },
  working_hours: { type: Number, default: null },
  status: { type: String, enum: ['on-time', 'late', 'early-leave', 'on-leave', 'incomplete'], default: null },
  check_in_qr_session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'QRSession', default: null },
  check_out_qr_session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'QRSession', default: null },
  verification_method: { type: String, enum: ['qr_only', 'qr_geo', 'qr_geo_face'], default: 'qr_only' },
  // Reserved for future geofencing phase — do not populate yet
  check_in_latitude: { type: Number, default: null },
  check_in_longitude: { type: Number, default: null },
  check_out_latitude: { type: Number, default: null },
  check_out_longitude: { type: Number, default: null },
});

// make unique once seeding/testing is finished.
attendanceSchema.index({ employee_id: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
