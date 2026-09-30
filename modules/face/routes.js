/**
 * Face Authentication — Routes
 * ─────────────────────────────
 * Mounted at /api/face in server.js
 *
 * All routes require authentication.
 * Enrol/delete require admin role.
 * Rate-limited globally.
 */

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireRole } = require('../../shared/middleware/auth.middleware');
const { getFaceMaxImageBytes } = require('../../shared/config/face');
const controller = require('./controller');

const router = express.Router();

// ─── Rate limiter for all face routes ───────────────────────────────────────

const faceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many face API requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(faceLimiter);

// ─── Multer config (memory storage) ─────────────────────────────────────────

function createUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: getFaceMaxImageBytes() },
    fileFilter: (_req, file, cb) => {
      // Accept JPEG and PNG (actual magic byte check is done in service/controller)
      if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(Object.assign(new Error('Only JPEG and PNG images are allowed.'), { status: 415 }), false);
      }
    },
  });
}

const singleUpload = createUpload().single('image');
const multiUpload = createUpload().fields([
  { name: 'neutral_frame', maxCount: 1 },
  { name: 'action_frame', maxCount: 1 },
]);

// Multer error handler wrapper
function handleMulterError(uploadFn) {
  return (req, res, next) => {
    uploadFn(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'Image file too large.' });
        }
        return res.status(err.status || 400).json({ error: err.message });
      }
      next();
    });
  };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/face/me — any authenticated user with an employee_id
router.get('/me', requireAuth, controller.getMyStatus);

// POST /api/face/enroll — admin only
router.post('/enroll',
  requireAuth,
  requireRole('Admin'),
  handleMulterError(singleUpload),
  controller.enrol
);

// DELETE /api/face/:employee_id — admin only
router.delete('/:employee_id',
  requireAuth,
  requireRole('Admin'),
  controller.revoke
);

// POST /api/face/challenge — any authenticated user with an employee_id
router.post('/challenge', requireAuth, controller.challenge);

// POST /api/face/verify — any authenticated user with an employee_id
router.post('/verify',
  requireAuth,
  handleMulterError(multiUpload),
  controller.verifyFace
);

module.exports = router;
