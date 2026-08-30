const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  designation: { type: String, required: true },
  contact_number: { type: String, default: null },
  date_of_joining: { type: Date, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
});

module.exports = mongoose.model('Employee', employeeSchema);
