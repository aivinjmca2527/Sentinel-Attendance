const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  leave_type: { type: String, enum: ['sick', 'casual', 'earned'], required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  reason: { type: String, default: null },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  applied_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
