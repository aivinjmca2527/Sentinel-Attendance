const mongoose = require('mongoose');

const authSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token_hash: { type: String, required: true },
  platform: { type: String, enum: ['web', 'mobile'], required: true },
  issued_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true }
});

module.exports = mongoose.model('AuthSession', authSessionSchema);
