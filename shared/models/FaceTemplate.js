const mongoose = require('mongoose');

const faceTemplateSchema = new mongoose.Schema({
  employee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    unique: true,
  },
  embedding: {
    type: [Number],
    required: true,
    select: false, // never returned by default
  },
  model_version: { type: String, required: true },
  enrolled_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  enrolled_at: { type: Date, default: Date.now },
  failed_attempts: { type: Number, default: 0 },
  locked_until: { type: Date, default: null },
});

module.exports = mongoose.model('FaceTemplate', faceTemplateSchema);
