const mongoose = require('mongoose');

const qrSessionSchema = new mongoose.Schema({
  department_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  code_value: { type: String, required: true },
  signature: { type: String, required: true },
  generated_at: { type: Date, required: true, default: Date.now },
  expires_at: { type: Date, required: true }
});

module.exports = mongoose.model('QRSession', qrSessionSchema);
