/**
 * Amazon Rekognition Face Provider — STUB
 * ─────────────────────────────────────────
 * This file documents how a managed face recognition service (e.g. AWS Rekognition)
 * would plug into the Sentinel face provider abstraction.
 *
 * To implement:
 *
 * 1. Install the AWS SDK:
 *    npm install @aws-sdk/client-rekognition
 *
 * 2. Configure environment variables:
 *    AWS_REGION=us-east-1
 *    AWS_ACCESS_KEY_ID=...
 *    AWS_SECRET_ACCESS_KEY=...
 *    FACE_REKOGNITION_COLLECTION_ID=sentinel-faces
 *
 * 3. Implement the two required functions:
 *
 *    analyze(imageBuffer) → { faceCount, embedding, yaw, quality }
 *      - Call rekognition.detectFaces({ Image: { Bytes: imageBuffer }, Attributes: ['ALL'] })
 *      - Return faceCount from FaceDetails.length
 *      - Use FaceDetails[0].Pose.Yaw for yaw
 *      - Use FaceDetails[0].Quality.Sharpness/Brightness for quality
 *      - For embedding, call rekognition.searchFacesByImage or store via IndexFaces
 *        (Rekognition manages its own embedding storage in Collections)
 *
 *    compare(a, b) → boolean
 *      - Call rekognition.compareFaces({ SourceImage, TargetImage, SimilarityThreshold })
 *      - Return FaceMatches.length > 0
 *      - Never return the similarity score to callers
 *
 * 4. Export { analyze, compare } to match the provider interface.
 *
 * 5. Add 'rekognition' to the FACE_PROVIDER switch in modules/face/service.js.
 *
 * Benefits of a managed provider:
 * - GPU-accelerated inference without managing infrastructure
 * - Built-in liveness detection (Rekognition Face Liveness)
 * - Collection-based face search at scale
 * - No model files to download or update
 *
 * Trade-offs:
 * - Per-API-call cost (~$1 per 1000 comparisons)
 * - Network latency (~200-500ms per call)
 * - Data leaves your infrastructure (privacy/compliance consideration)
 * - Vendor lock-in
 */

// Not implemented — this is a documentation stub.
// To activate: implement analyze() and compare(), then set FACE_PROVIDER=rekognition.

module.exports = {
  analyze() {
    throw new Error('[FaceProvider:rekognition] Not implemented. See this file for integration guide.');
  },
  compare() {
    throw new Error('[FaceProvider:rekognition] Not implemented. See this file for integration guide.');
  },
};
