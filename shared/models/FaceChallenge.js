const mongoose = require('mongoose');

const faceChallengeSchema = new mongoose.Schema({
  challenge_id: { type: String, required: true, unique: true },
  employee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  challenge: {
    type: String,
    enum: ['turn_left', 'turn_right'],
    required: true,
  },
  neutral_yaw: { type: Number, default: null },
  expires_at: { type: Date, required: true },
  used: { type: Boolean, default: false },
});

// TTL index — MongoDB auto-deletes expired documents
faceChallengeSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Fast lookup by employee for invalidation
faceChallengeSchema.index({ employee_id: 1 });

module.exports = mongoose.model('FaceChallenge', faceChallengeSchema);
