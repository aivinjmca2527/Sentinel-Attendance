/**
 * Mock Face Provider (test-only)
 * ──────────────────────────────
 * Treats the image buffer as UTF-8 text like "person:<id>;yaw:<n>"
 * and derives a deterministic embedding and yaw from it.
 *
 * Refuses to load when NODE_ENV === 'production'.
 */

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    '[FaceProvider:mock] Mock face provider CANNOT be loaded in production. ' +
    'Set FACE_PROVIDER=local or remove the setting.'
  );
}

const crypto = require('crypto');
const { getFaceMatchThreshold } = require('../../../shared/config/face');

/**
 * Parse the mock image buffer.
 * Expected format: "person:<id>;yaw:<degrees>"
 * e.g. "person:abc123;yaw:25"
 */
function parseBuffer(imageBuffer) {
  const text = imageBuffer.toString('utf-8').trim();
  const personMatch = text.match(/person:([^;]+)/);
  const yawMatch = text.match(/yaw:(-?\d+(?:\.\d+)?)/);

  if (!personMatch) {
    return null; // simulate "no face detected"
  }

  return {
    personId: personMatch[1],
    yaw: yawMatch ? parseFloat(yawMatch[1]) : 0,
  };
}

/**
 * Derive a deterministic 128-d embedding from a person ID.
 * Same person ID → same embedding → match.
 */
function deriveEmbedding(personId) {
  const hash = crypto.createHash('sha256').update(personId).digest();
  const embedding = [];
  for (let i = 0; i < 128; i++) {
    // Use bytes cyclically, normalized to [-1, 1]
    embedding.push((hash[i % hash.length] / 127.5) - 1);
  }
  // Normalize to unit vector
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  return embedding.map(v => v / norm);
}

/**
 * Euclidean distance between two embeddings.
 */
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * analyze(imageBuffer) → { faceCount, embedding, yaw, quality }
 */
function analyze(imageBuffer) {
  const parsed = parseBuffer(imageBuffer);

  if (!parsed) {
    return { faceCount: 0, embedding: null, yaw: null, quality: 0 };
  }

  return {
    faceCount: 1,
    embedding: deriveEmbedding(parsed.personId),
    yaw: parsed.yaw,
    quality: 0.95,
  };
}

/**
 * compare(a, b) → boolean
 * Returns true if match; never exposes the distance.
 */
function compare(a, b) {
  const dist = euclideanDistance(a, b);
  return dist <= getFaceMatchThreshold();
}

module.exports = { analyze, compare };
