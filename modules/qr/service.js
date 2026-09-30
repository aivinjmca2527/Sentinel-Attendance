/**
 * QR Session Rotation Service
 * ----------------------------
 * Background loop that generates a fresh HMAC-signed QR code every ~5 seconds.
 * Each code has a short expiry (10 seconds) to prevent replay/cloning attacks.
 *
 * Started automatically when the server boots (see server.js or controller init).
 */

const crypto = require('crypto');
const QRSession = require('../../shared/models/QRSession');

const QR_SIGNING_SECRET = process.env.QR_SIGNING_SECRET || 'default-dev-secret';
const ROTATION_INTERVAL_MS = 5000;  // ~5 seconds between rotations
const CODE_EXPIRY_SECONDS = 10;     // each code is valid for 10 seconds

/**
 * Generate a new QRSession document with a random code_value,
 * HMAC-SHA256 signature, and a short expiry window.
 * @returns {Promise<Document>} The saved QRSession document
 */
async function generateQRSession(departmentId) {
  const code_value = crypto.randomBytes(32).toString('hex');
  const signature = crypto
    .createHmac('sha256', QR_SIGNING_SECRET)
    .update(code_value)
    .digest('hex');

  const now = new Date();
  const expirySeconds = currentSettings.intervalSeconds || 15;
  const expires_at = new Date(now.getTime() + expirySeconds * 1000);

  if (!departmentId) {
    try {
      const Department = require('../../shared/models/Department');
      const dept = await Department.findOne().lean();
      if (dept) departmentId = dept._id;
    } catch (_) {}
  }

  const sessionData = {
    code_value,
    signature,
    generated_at: now,
    expires_at,
  };
  if (departmentId) {
    sessionData.department_id = departmentId;
  }

  const session = new QRSession(sessionData);

  await session.save();
  return session;
}

/**
 * Return the latest non-expired QRSession, or generate a new one if none valid.
 * @returns {Promise<Document>}
 */
async function getOrCreateCurrentSession(departmentId) {
  const now = new Date();
  const query = { expires_at: { $gt: now } };
  if (departmentId) {
    query.department_id = departmentId;
  }
  const current = await QRSession.findOne(query)
    .sort({ generated_at: -1 })
    .lean();

  if (current) return current;
  return (await generateQRSession(departmentId)).toObject();
}

/** Background rotation interval reference (for cleanup if needed) */
let rotationInterval = null;

/**
 * Start the background QR rotation loop.
 * Safe to call multiple times — only one loop runs.
 */
function startRotationLoop() {
  if (rotationInterval) return; // already running

  const intervalSec = currentSettings.intervalSeconds || 15;
  const intervalMs = intervalSec * 1000;
  console.log('[QR Service] Starting QR rotation loop ' +
    `(interval: ${intervalMs}ms, expiry: ${intervalSec}s)`);

  rotationInterval = setInterval(async () => {
    try {
      const session = await generateQRSession();
      console.log(`[QR Service] New QR session: ${session._id} ` +
        `(expires ${session.expires_at.toISOString()})`);
    } catch (err) {
      console.error('[QR Service] Failed to rotate QR session:', err.message);
    }
  }, intervalMs);
}

/**
 * Stop the rotation loop (useful for graceful shutdown / testing).
 */
function stopRotationLoop() {
  if (rotationInterval) {
    clearInterval(rotationInterval);
    rotationInterval = null;
    console.log('[QR Service] Rotation loop stopped.');
  }
}

let currentSettings = {
  intervalSeconds: 15,
  geofenceEnabled: true,
  cryptoSigningEnabled: true,
};

/**
 * Return current QR security settings.
 */
function getSettings() {
  const { getGeofenceMode } = require('../../shared/config/geofence');
  const currentMode = getGeofenceMode();
  return {
    ...currentSettings,
    geofenceEnabled: currentMode !== 'off',
    geofenceMode: currentMode,
  };
}

/**
 * Update QR security settings.
 * @param {Object} newSettings
 */
function updateSettings(newSettings) {
  let intervalChanged = false;
  if (typeof newSettings.intervalSeconds === 'number') {
    const val = Math.max(5, Math.min(60, Math.round(newSettings.intervalSeconds)));
    if (val !== currentSettings.intervalSeconds) {
      currentSettings.intervalSeconds = val;
      intervalChanged = true;
    }
  }

  if (typeof newSettings.geofenceEnabled === 'boolean') {
    currentSettings.geofenceEnabled = newSettings.geofenceEnabled;
    const { setGeofenceMode } = require('../../shared/config/geofence');
    if (!newSettings.geofenceEnabled) {
      setGeofenceMode('off');
    } else {
      setGeofenceMode(newSettings.geofenceMode || 'enforce');
    }
  }

  if (intervalChanged && rotationInterval) {
    clearInterval(rotationInterval);
    rotationInterval = null;
    startRotationLoop();
  }

  return getSettings();
}

/**
 * Force immediate rotation of QR session (e.g. key regeneration).
 * @returns {Promise<Object>}
 */
async function forceRotateSession() {
  const session = await generateQRSession();
  return session.toObject ? session.toObject() : session;
}

module.exports = {
  generateQRSession,
  getOrCreateCurrentSession,
  startRotationLoop,
  stopRotationLoop,
  getSettings,
  updateSettings,
  forceRotateSession,
};

