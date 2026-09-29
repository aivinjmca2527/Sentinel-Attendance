/**
 * QR Session Service
 * ----------------------------
 * Generates a fresh HMAC-signed QR code on demand, scoped per department.
 * Each code has a short expiry (10 seconds) to prevent replay/cloning attacks.
 */

const crypto = require('crypto');
const QRSession = require('../../shared/models/QRSession');

const QR_SIGNING_SECRET = process.env.QR_SIGNING_SECRET || 'default-dev-secret';
const CODE_EXPIRY_SECONDS = 10;     // each code is valid for 10 seconds

/**
 * Generate a new QRSession document with a random code_value,
 * HMAC-SHA256 signature, and a short expiry window.
 * @param {string} departmentId - The department this QR session belongs to
 * @returns {Promise<Document>} The saved QRSession document
 */
async function generateQRSession(departmentId) {
  const code_value = crypto.randomBytes(32).toString('hex');
  const signature = crypto
    .createHmac('sha256', QR_SIGNING_SECRET)
    .update(code_value)
    .digest('hex');

  const now = new Date();
  const expires_at = new Date(now.getTime() + CODE_EXPIRY_SECONDS * 1000);

  const session = new QRSession({
    department_id: departmentId,
    code_value,
    signature,
    generated_at: now,
    expires_at,
  });

  await session.save();
  return session;
}

/**
 * Return the latest non-expired QRSession for a department,
 * or generate a new one if none valid.
 * @param {string} departmentId - The department to get/create a session for
 * @returns {Promise<Document>}
 */
async function getOrCreateCurrentSession(departmentId) {
  const now = new Date();
  const current = await QRSession.findOne({
    department_id: departmentId,
    expires_at: { $gt: now }
  })
    .sort({ generated_at: -1 })
    .lean();

  if (current) return current;
  return (await generateQRSession(departmentId)).toObject();
}

module.exports = {
  generateQRSession,
  getOrCreateCurrentSession,
};
