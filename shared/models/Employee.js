const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  designation: { type: String, required: true },
  contact_number: { type: String, default: null },
  date_of_joining: { type: Date, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  // ─── Shift Schedule ──────────────────────────────────────────────────────────
  // HH:MM 24-hour format, e.g. "09:00". Falls back to CHECK_IN_CUTOFF env var if null.
  shift_start: { type: String, default: '09:00' },
  // HH:MM 24-hour format. Not enforced as a hard cutoff, informational.
  shift_end: { type: String, default: '16:30' },
  // Minimum hours employee must work before checkout is considered on-time.
  // Falls back to STANDARD_WORK_HOURS env var if null.
  min_work_hours: { type: Number, default: null }
});

module.exports = mongoose.model('Employee', employeeSchema);
