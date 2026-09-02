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
async function generateQRSession() {
  const code_value = crypto.randomBytes(32).toString('hex');
  const signature = crypto
    .createHmac('sha256', QR_SIGNING_SECRET)
    .update(code_value)
    .digest('hex');

  const now = new Date();
  const expires_at = new Date(now.getTime() + CODE_EXPIRY_SECONDS * 1000);

  const session = new QRSession({
    code_value,
    signature,
    generated_at: now,
    expires_at,
  });

  await session.save();
  return session;
}

/**
 * Return the latest non-expired QRSession, or generate a new one if none valid.
 * @returns {Promise<Document>}
 */
async function getOrCreateCurrentSession() {
  const now = new Date();
  const current = await QRSession.findOne({ expires_at: { $gt: now } })
    .sort({ generated_at: -1 })
    .lean();

  if (current) return current;
  return (await generateQRSession()).toObject();
}

/** Background rotation interval reference (for cleanup if needed) */
let rotationInterval = null;

/**
 * Start the background QR rotation loop.
 * Safe to call multiple times — only one loop runs.
 */
function startRotationLoop() {
  if (rotationInterval) return; // already running

  console.log('[QR Service] Starting QR rotation loop ' +
    `(interval: ${ROTATION_INTERVAL_MS}ms, expiry: ${CODE_EXPIRY_SECONDS}s)`);

  rotationInterval = setInterval(async () => {
    try {
      const session = await generateQRSession();
      console.log(`[QR Service] New QR session: ${session._id} ` +
        `(expires ${session.expires_at.toISOString()})`);
    } catch (err) {
      console.error('[QR Service] Failed to rotate QR session:', err.message);
    }
  }, ROTATION_INTERVAL_MS);
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

module.exports = {
  generateQRSession,
  getOrCreateCurrentSession,
  startRotationLoop,
  stopRotationLoop,
};
