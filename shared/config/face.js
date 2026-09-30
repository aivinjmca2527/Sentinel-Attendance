/**
 * Face Authentication Configuration
 * -----------------------------------
 * Manages face verification mode and settings.
 * Mirrors the geofence config pattern (shared/config/geofence.js).
 *
 * Modes:
 * - 'off':     Bypass all face verification (default).
 * - 'log':     Validate face and log security alerts, without blocking check-in/out.
 * - 'enforce': Reject check-in/out without a valid face proof (403).
 */

const { isTestOverrideAuthorized } = require('./geofence');

// ─── Configuration getters ──────────────────────────────────────────────────

function getFaceMode(reqOrCtx) {
  // Allow X-Face-Mode header override in test environment when authorized
  if (isTestOverrideAuthorized(reqOrCtx)) {
    const headers = reqOrCtx.headers || (reqOrCtx.req && reqOrCtx.req.headers);
    if (headers && headers['x-face-mode']) {
      const override = headers['x-face-mode'].toLowerCase().trim();
      if (['off', 'log', 'enforce'].includes(override)) {
        return override;
      }
    }
  }

  const mode = (process.env.FACE_MODE || 'off').toLowerCase().trim();
  if (['off', 'log', 'enforce'].includes(mode)) {
    return mode;
  }
  return 'off';
}

function getFaceProvider() {
  return (process.env.FACE_PROVIDER || 'local').toLowerCase().trim();
}

function getFaceMatchThreshold() {
  const val = parseFloat(process.env.FACE_MATCH_THRESHOLD);
  return !isNaN(val) && val > 0 ? val : 0.5;
}

function getFaceProofTTL() {
  const val = parseInt(process.env.FACE_PROOF_TTL_SECONDS, 10);
  return !isNaN(val) && val > 0 ? val : 120;
}

function getFaceChallengeTTL() {
  const val = parseInt(process.env.FACE_CHALLENGE_TTL_SECONDS, 10);
  return !isNaN(val) && val > 0 ? val : 30;
}

function getFaceMinYawDelta() {
  const val = parseFloat(process.env.FACE_MIN_YAW_DELTA);
  return !isNaN(val) && val > 0 ? val : 15;
}

function getFaceMaxFailedAttempts() {
  const val = parseInt(process.env.FACE_MAX_FAILED_ATTEMPTS, 10);
  return !isNaN(val) && val > 0 ? val : 5;
}

function getFaceLockoutMinutes() {
  const val = parseInt(process.env.FACE_LOCKOUT_MINUTES, 10);
  return !isNaN(val) && val > 0 ? val : 15;
}

function getFaceMaxImageBytes() {
  const val = parseInt(process.env.FACE_MAX_IMAGE_BYTES, 10);
  return !isNaN(val) && val > 0 ? val : 1500000;
}

function getFaceStorePhoto() {
  return (process.env.FACE_STORE_PHOTO || '').toLowerCase() === 'true';
}

module.exports = {
  getFaceMode,
  getFaceProvider,
  getFaceMatchThreshold,
  getFaceProofTTL,
  getFaceChallengeTTL,
  getFaceMinYawDelta,
  getFaceMaxFailedAttempts,
  getFaceLockoutMinutes,
  getFaceMaxImageBytes,
  getFaceStorePhoto,
};
