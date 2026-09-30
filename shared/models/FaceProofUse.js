const mongoose = require('mongoose');

const faceProofUseSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  employee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  consumed_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true },
});

// TTL index — auto-clean consumed proofs after they expire
faceProofUseSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('FaceProofUse', faceProofUseSchema);
