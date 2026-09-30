/**
 * Local Face Provider — @vladmandic/face-api + WASM TensorFlow
 * ──────────────────────────────────────────────────────────────
 * 128-d embeddings; yaw estimated from 68 landmarks.
 * Requires exactly 1 face, minimum face size, minimum detection confidence.
 * Match when Euclidean distance ≤ FACE_MATCH_THRESHOLD (default 0.5).
 */

const path = require('path');
const { getFaceMatchThreshold } = require('../../../shared/config/face');

let faceapi;
let tf;
let initialized = false;
let initPromise = null;

const MODEL_DIR = path.join(
  require.resolve('@vladmandic/face-api'),
  '..', 'model'
);

const MIN_FACE_SIZE = 80;       // minimum face width/height in pixels
const MIN_CONFIDENCE = 0.5;     // minimum detection confidence

/**
 * Lazy-initialize face-api with WASM backend.
 */
async function ensureInit() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Use @tensorflow/tfjs which includes WASM backend
    tf = require('@tensorflow/tfjs');

    // Try to set WASM backend; fall back to CPU if unavailable
    try {
      await tf.setBackend('cpu');
      await tf.ready();
    } catch (_e) {
      await tf.setBackend('cpu');
      await tf.ready();
    }

    faceapi = require('@vladmandic/face-api');

    // Load required models
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);

    initialized = true;
  })();

  return initPromise;
}

/**
 * Decode an image buffer (JPEG/PNG) into a tensor.
 */
function bufferToTensor(imageBuffer) {
  // Detect format from magic bytes
  const isJPEG = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8;
  const isPNG = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50;

  if (!isJPEG && !isPNG) {
    throw new Error('UNSUPPORTED_FORMAT');
  }

  // Use node-canvas or direct decode via tfjs
  // @vladmandic/face-api has built-in canvas support for node
  const canvas = faceapi.createCanvasFromMedia
    ? null // Will use fetchImage instead
    : null;

  // Use tf.node.decode* if available, else fall back
  if (tf.node && tf.node.decodeImage) {
    return tf.node.decodeImage(imageBuffer, 3);
  }

  // Fallback: manual decode
  throw new Error('Cannot decode image without tf.node. Install @tensorflow/tfjs-node or use the mock provider for testing.');
}

/**
 * Estimate yaw angle from 68 facial landmarks.
 * Uses nose-tip offset relative to eye midpoint / face width.
 *
 * Positive yaw = face turned right (from subject's perspective)
 * Negative yaw = face turned left
 */
function estimateYaw(landmarks) {
  const positions = landmarks.positions;

  // Eye midpoint (landmarks 36-41 = left eye, 42-47 = right eye)
  const leftEyeCenter = {
    x: (positions[36].x + positions[39].x) / 2,
    y: (positions[36].y + positions[39].y) / 2,
  };
  const rightEyeCenter = {
    x: (positions[42].x + positions[45].x) / 2,
    y: (positions[42].y + positions[45].y) / 2,
  };
  const eyeMidpoint = {
    x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
    y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
  };

  // Face width (approximate from outer eye corners)
  const faceWidth = Math.abs(positions[45].x - positions[36].x);
  if (faceWidth < 1) return 0;

  // Nose tip (landmark 30)
  const noseTip = positions[30];

  // Offset of nose tip from eye midpoint, normalized by face width
  const offset = (noseTip.x - eyeMidpoint.x) / faceWidth;

  // Convert to approximate degrees (empirical scaling)
  // offset of ~0.25 ≈ 30 degrees
  const yawDegrees = offset * 120;

  return yawDegrees;
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
async function analyze(imageBuffer) {
  await ensureInit();

  let tensor;
  try {
    tensor = bufferToTensor(imageBuffer);
  } catch (e) {
    if (e.message === 'UNSUPPORTED_FORMAT') {
      return { faceCount: 0, embedding: null, yaw: null, quality: 0 };
    }
    throw e;
  }

  try {
    const detections = await faceapi
      .detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    const faceCount = detections.length;

    if (faceCount !== 1) {
      return { faceCount, embedding: null, yaw: null, quality: 0 };
    }

    const det = detections[0];
    const box = det.detection.box;

    // Minimum face size check
    if (box.width < MIN_FACE_SIZE || box.height < MIN_FACE_SIZE) {
      return { faceCount: 0, embedding: null, yaw: null, quality: 0 };
    }

    const embedding = Array.from(det.descriptor); // 128-d Float32Array → plain array
    const yaw = estimateYaw(det.landmarks);
    const quality = det.detection.score;

    return { faceCount, embedding, yaw, quality };
  } finally {
    if (tensor && tensor.dispose) tensor.dispose();
  }
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
