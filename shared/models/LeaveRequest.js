const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  leave_type: { type: String, enum: ['sick', 'casual', 'earned'], required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  number_of_days: { type: Number, default: 1 },
  reason: { type: String, default: null },
  status: { type: String, enum: ['pending', 'approved', 'denied', 'cancelled'], default: 'pending' },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  denial_reason: { type: String, default: null },
  applied_at: { type: Date, default: Date.now },
  reviewed_at: { type: Date, default: null }
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
