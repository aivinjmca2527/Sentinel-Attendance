/**
 * Face Authentication — Service Layer
 * ────────────────────────────────────
 * Business logic for face enrolment, challenge, verification, and proof issuance.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const FaceTemplate = require('../../shared/models/FaceTemplate');
const FaceChallenge = require('../../shared/models/FaceChallenge');
const SecurityAlert = require('../../shared/models/SecurityAlert');
const Employee = require('../../shared/models/Employee');

const {
  getFaceProvider,
  getFaceMatchThreshold,
  getFaceProofTTL,
  getFaceChallengeTTL,
  getFaceMinYawDelta,
  getFaceMaxFailedAttempts,
  getFaceLockoutMinutes,
  getFaceStorePhoto,
} = require('../../shared/config/face');

// ─── Provider loading ───────────────────────────────────────────────────────

let _provider = null;

function getProvider() {
  if (_provider) return _provider;

  const name = getFaceProvider();
  switch (name) {
    case 'mock':
      _provider = require('./providers/mock');
      break;
    case 'local':
      _provider = require('./providers/local');
      break;
    case 'rekognition':
      _provider = require('./providers/rekognition');
      break;
    default:
      throw new Error(`Unknown FACE_PROVIDER: "${name}". Valid options: mock, local, rekognition.`);
  }
  return _provider;
}

// Allow tests to reset the cached provider
function resetProvider() {
  _provider = null;
}

// ─── Alert helper (matches geofence pattern) ────────────────────────────────

async function logSecurityAlert(employee_id, alert_type, message, metadata = {}) {
  try {
    await SecurityAlert.create({
      employee_id,
      alert_type,
      severity: 'high',
      message,
      metadata,
    });
  } catch (alertErr) {
    console.error(
      `[ALERT_WRITE_FAILURE] employee_id=${employee_id} alert_type=${alert_type} error=${alertErr.message}`
    );
  }
}

// ─── Lockout helpers ────────────────────────────────────────────────────────

function isLockedOut(template) {
  if (!template.locked_until) return false;
  return new Date() < new Date(template.locked_until);
}

function getLockoutRetrySeconds(template) {
  if (!template.locked_until) return 0;
  const diff = new Date(template.locked_until).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 1000));
}

// ─── Magic byte check ───────────────────────────────────────────────────────

function validateImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  return false;
}

// ─── Service functions ──────────────────────────────────────────────────────

/**
 * Get face status for the authenticated employee.
 */
async function getMyFaceStatus(employee_id, faceMode) {
  const template = await FaceTemplate.findOne({ employee_id });

  return {
    face_mode: faceMode,
    enrolled: !!template,
    enrolled_at: template ? template.enrolled_at : null,
    locked_until: template && isLockedOut(template) ? template.locked_until : null,
  };
}

/**
 * Enrol a face template for an employee (admin only).
 */
async function enrol(employee_id, imageBuffer, enrolled_by, options = {}) {
  const { consent_confirmed, replace } = options;

  // Consent check
  if (consent_confirmed !== 'true') {
    const err = new Error('CONSENT_REQUIRED');
    err.status = 400;
    err.body = { error: 'CONSENT_REQUIRED' };
    throw err;
  }

  // Employee exists?
  const emp = await Employee.findById(employee_id);
  if (!emp) {
    const err = new Error('EMPLOYEE_NOT_FOUND');
    err.status = 404;
    err.body = { error: 'EMPLOYEE_NOT_FOUND' };
    throw err;
  }

  // Validate image
  if (!validateImageMagicBytes(imageBuffer)) {
    const err = new Error('Invalid image format');
    err.status = 415;
    err.body = { error: 'INVALID_IMAGE_FORMAT' };
    throw err;
  }

  // Analyze image
  const provider = getProvider();
  const result = typeof provider.analyze === 'function' && provider.analyze.constructor.name === 'AsyncFunction'
    ? await provider.analyze(imageBuffer)
    : provider.analyze(imageBuffer);

  if (result.faceCount === 0) {
    const err = new Error('NO_FACE');
    err.status = 400;
    err.body = { error: 'NO_FACE' };
    throw err;
  }

  if (result.faceCount > 1) {
    const err = new Error('MULTIPLE_FACES');
    err.status = 400;
    err.body = { error: 'MULTIPLE_FACES' };
    throw err;
  }

  if (result.quality < 0.3) {
    const err = new Error('LOW_QUALITY');
    err.status = 400;
    err.body = { error: 'LOW_QUALITY' };
    throw err;
  }

  // Check existing template
  const existing = await FaceTemplate.findOne({ employee_id });

  if (existing && replace !== 'true') {
    const err = new Error('FACE_ALREADY_ENROLLED');
    err.status = 409;
    err.body = { error: 'FACE_ALREADY_ENROLLED' };
    throw err;
  }

  const now = new Date();
  const model_version = getFaceProvider() + '-v1';

  if (existing && replace === 'true') {
    // Re-enrolment
    existing.embedding = result.embedding;
    existing.model_version = model_version;
    existing.enrolled_by = enrolled_by;
    existing.enrolled_at = now;
    existing.failed_attempts = 0;
    existing.locked_until = null;
    await existing.save();

    await logSecurityAlert(employee_id, 'face_reenrolled',
      'Face template re-enrolled by admin.',
      { enrolled_by }
    );

    return {
      employee_id,
      enrolled: true,
      model_version,
      enrolled_at: now,
    };
  }

  // New enrolment
  await FaceTemplate.create({
    employee_id,
    embedding: result.embedding,
    model_version,
    enrolled_by,
    enrolled_at: now,
  });

  return {
    employee_id,
    enrolled: true,
    model_version,
    enrolled_at: now,
  };
}

/**
 * Delete a face template (admin only).
 */
async function revoke(employee_id) {
  const template = await FaceTemplate.findOne({ employee_id });
  if (!template) {
    const err = new Error('FACE_NOT_ENROLLED');
    err.status = 404;
    err.body = { error: 'FACE_NOT_ENROLLED' };
    throw err;
  }

  await FaceTemplate.deleteOne({ employee_id });

  await logSecurityAlert(employee_id, 'face_revoked',
    'Face template revoked by admin.'
  );

  return { revoked: true };
}

/**
 * Issue a face challenge.
 */
async function createChallenge(employee_id) {
  // Check enrolment
  const template = await FaceTemplate.findOne({ employee_id });
  if (!template) {
    const err = new Error('FACE_NOT_ENROLLED');
    err.status = 403;
    err.body = { error: 'FACE_NOT_ENROLLED' };
    throw err;
  }

  // Check lockout
  if (isLockedOut(template)) {
    const err = new Error('FACE_LOCKED');
    err.status = 429;
    err.body = {
      error: 'FACE_LOCKED',
      retry_after_seconds: getLockoutRetrySeconds(template),
    };
    throw err;
  }

  // Invalidate any existing active challenges for this employee
  await FaceChallenge.updateMany(
    { employee_id, used: false },
    { $set: { used: true } }
  );

  // Pick direction with crypto.randomInt
  const direction = crypto.randomInt(2) === 0 ? 'turn_left' : 'turn_right';
  const ttl = getFaceChallengeTTL();
  const challenge_id = crypto.randomUUID();
  const expires_at = new Date(Date.now() + ttl * 1000);

  await FaceChallenge.create({
    challenge_id,
    employee_id,
    challenge: direction,
    expires_at,
  });

  return {
    challenge_id,
    challenge: direction,
    expires_at,
    ttl_seconds: ttl,
  };
}

/**
 * Verify face against challenge and issue a proof token.
 */
async function verify(employee_id, challenge_id, neutralBuffer, actionBuffer, intended_action) {
  const FACE_PROOF_SECRET = process.env.FACE_PROOF_SECRET;
  if (!FACE_PROOF_SECRET) {
    throw new Error('[Face] FACE_PROOF_SECRET is not configured.');
  }

  // Load challenge (exists, belongs to caller, not used, not expired)
  const challenge = await FaceChallenge.findOneAndUpdate(
    {
      challenge_id,
      employee_id,
      used: false,
      expires_at: { $gt: new Date() },
    },
    { $set: { used: true } },
    { new: false } // return the pre-update doc to confirm it existed
  );

  if (!challenge) {
    // Determine specific error
    const any = await FaceChallenge.findOne({ challenge_id });
    if (!any) {
      const err = new Error('CHALLENGE_INVALID');
      err.status = 400;
      err.body = { error: 'CHALLENGE_INVALID' };
      throw err;
    }
    if (String(any.employee_id) !== String(employee_id)) {
      const err = new Error('CHALLENGE_INVALID');
      err.status = 400;
      err.body = { error: 'CHALLENGE_INVALID' };
      throw err;
    }
    if (any.used) {
      const err = new Error('CHALLENGE_INVALID');
      err.status = 400;
      err.body = { error: 'CHALLENGE_INVALID' };
      throw err;
    }
    if (new Date() > new Date(any.expires_at)) {
      const err = new Error('CHALLENGE_EXPIRED');
      err.status = 400;
      err.body = { error: 'CHALLENGE_EXPIRED' };
      throw err;
    }
    const err = new Error('CHALLENGE_INVALID');
    err.status = 400;
    err.body = { error: 'CHALLENGE_INVALID' };
    throw err;
  }

  // Check lockout
  const template = await FaceTemplate.findOne({ employee_id }).select('+embedding');
  if (!template) {
    const err = new Error('FACE_NOT_ENROLLED');
    err.status = 403;
    err.body = { error: 'FACE_NOT_ENROLLED' };
    throw err;
  }

  if (isLockedOut(template)) {
    const err = new Error('FACE_LOCKED');
    err.status = 429;
    err.body = {
      error: 'FACE_LOCKED',
      retry_after_seconds: getLockoutRetrySeconds(template),
    };
    throw err;
  }

  // Analyze both frames
  const provider = getProvider();
  const analyzeOne = async (buf) => {
    return typeof provider.analyze === 'function' && provider.analyze.constructor.name === 'AsyncFunction'
      ? await provider.analyze(buf)
      : provider.analyze(buf);
  };

  const neutralResult = await analyzeOne(neutralBuffer);
  const actionResult = await analyzeOne(actionBuffer);

  // Exactly 1 face each
  if (neutralResult.faceCount !== 1) {
    const err = new Error(neutralResult.faceCount === 0 ? 'NO_FACE' : 'MULTIPLE_FACES');
    err.status = 400;
    err.body = { error: err.message };
    throw err;
  }
  if (actionResult.faceCount !== 1) {
    const err = new Error(actionResult.faceCount === 0 ? 'NO_FACE' : 'MULTIPLE_FACES');
    err.status = 400;
    err.body = { error: err.message };
    throw err;
  }

  // Helper for failed attempts
  const handleFailure = async (alert_type, message) => {
    template.failed_attempts = (template.failed_attempts || 0) + 1;
    const maxAttempts = getFaceMaxFailedAttempts();
    const remaining = Math.max(0, maxAttempts - template.failed_attempts);

    if (template.failed_attempts >= maxAttempts) {
      const lockoutMinutes = getFaceLockoutMinutes();
      template.locked_until = new Date(Date.now() + lockoutMinutes * 60 * 1000);
      await template.save();

      await logSecurityAlert(employee_id, 'face_locked',
        `Face locked after ${maxAttempts} failed attempts. Locked for ${lockoutMinutes} minutes.`
      );

      const err = new Error('FACE_LOCKED');
      err.status = 429;
      err.body = {
        error: 'FACE_LOCKED',
        retry_after_seconds: lockoutMinutes * 60,
      };
      throw err;
    }

    await template.save();
    await logSecurityAlert(employee_id, alert_type, message);

    const err = new Error(alert_type === 'face_mismatch' ? 'FACE_MISMATCH' : 'LIVENESS_FAILED');
    err.status = 403;
    err.body = {
      error: alert_type === 'face_mismatch' ? 'FACE_MISMATCH' : 'LIVENESS_FAILED',
      attempts_remaining: remaining,
    };
    throw err;
  };

  // Both faces must match the enrolled template
  if (!provider.compare(neutralResult.embedding, template.embedding)) {
    await handleFailure('face_mismatch', 'Neutral frame does not match enrolled template.');
  }
  if (!provider.compare(actionResult.embedding, template.embedding)) {
    await handleFailure('face_mismatch', 'Action frame does not match enrolled template.');
  }

  // Liveness: action_frame yaw must differ from neutral_frame yaw by at least
  // FACE_MIN_YAW_DELTA in the direction of the challenge
  const yawDelta = actionResult.yaw - neutralResult.yaw;
  const minDelta = getFaceMinYawDelta();

  let livenessPass = false;
  if (challenge.challenge === 'turn_right') {
    // Positive yaw delta expected (nose moves right)
    livenessPass = yawDelta >= minDelta;
  } else {
    // turn_left: Negative yaw delta expected (nose moves left)
    livenessPass = yawDelta <= -minDelta;
  }

  if (!livenessPass) {
    await handleFailure('liveness_failed',
      `Liveness failed: yaw delta ${yawDelta.toFixed(1)}° for challenge ${challenge.challenge} (min: ${minDelta}°).`
    );
  }

  // Pass — reset failed_attempts
  template.failed_attempts = 0;
  template.locked_until = null;
  await template.save();

  // Store neutral yaw on the challenge (optional diagnostic)
  await FaceChallenge.updateOne(
    { challenge_id },
    { $set: { neutral_yaw: neutralResult.yaw } }
  );

  // Issue the proof token
  const jti = crypto.randomUUID();
  const proofTTL = getFaceProofTTL();
  const action = intended_action || 'any';
  const exp_at = new Date(Date.now() + proofTTL * 1000);

  const face_proof = jwt.sign(
    {
      sub: employee_id.toString(),
      employee_id: employee_id.toString(),
      purpose: 'face_proof',
      jti,
      intended_action: action,
    },
    FACE_PROOF_SECRET,
    { expiresIn: proofTTL }
  );

  return {
    face_proof,
    expires_at: exp_at,
    intended_action: action,
  };
}

module.exports = {
  getMyFaceStatus,
  enrol,
  revoke,
  createChallenge,
  verify,
  getProvider,
  resetProvider,
  validateImageMagicBytes,
  logSecurityAlert,
};
