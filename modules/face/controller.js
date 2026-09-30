/**
 * Face Authentication — Controller
 * ─────────────────────────────────
 * HTTP handlers for face enrolment, challenge, verification, and status.
 */

const { getFaceMode } = require('../../shared/config/face');
const faceService = require('./service');

// ─── GET /api/face/me ───────────────────────────────────────────────────────

async function getMyStatus(req, res) {
  try {
    const employee_id = req.user?.employee_id;
    if (!employee_id) {
      return res.status(400).json({ error: 'No employee_id in token.' });
    }

    const faceMode = getFaceMode(req);
    const result = await faceService.getMyFaceStatus(employee_id, faceMode);
    return res.json(result);
  } catch (err) {
    console.error('[Face:getMyStatus]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── POST /api/face/enroll ──────────────────────────────────────────────────

async function enrol(req, res) {
  try {
    const employee_id = req.body?.employee_id;
    if (!employee_id) {
      return res.status(400).json({ error: 'employee_id is required.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required.' });
    }

    // Magic byte check done in service, but also reject oversized here
    // (multer limit should catch this, but double-check)

    const result = await faceService.enrol(
      employee_id,
      req.file.buffer,
      req.user.id, // enrolled_by = admin's user id
      {
        consent_confirmed: req.body?.consent_confirmed,
        replace: req.body?.replace,
      }
    );

    return res.status(201).json(result);
  } catch (err) {
    const status = err.status || 500;
    if (err.body) return res.status(status).json(err.body);
    console.error('[Face:enrol]', err.message);
    return res.status(status).json({ error: err.message });
  }
}

// ─── DELETE /api/face/:employee_id ──────────────────────────────────────────

async function revoke(req, res) {
  try {
    const employee_id = req.params.employee_id;
    if (!employee_id) {
      return res.status(400).json({ error: 'employee_id is required.' });
    }

    const result = await faceService.revoke(employee_id);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (err.body) return res.status(status).json(err.body);
    console.error('[Face:revoke]', err.message);
    return res.status(status).json({ error: err.message });
  }
}

// ─── POST /api/face/challenge ───────────────────────────────────────────────

async function challenge(req, res) {
  try {
    const employee_id = req.user?.employee_id;
    if (!employee_id) {
      return res.status(400).json({ error: 'No employee_id in token.' });
    }

    const result = await faceService.createChallenge(employee_id);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (err.body) return res.status(status).json(err.body);
    console.error('[Face:challenge]', err.message);
    return res.status(status).json({ error: err.message });
  }
}

// ─── POST /api/face/verify ─────────────────────────────────────────────────

async function verifyFace(req, res) {
  try {
    const employee_id = req.user?.employee_id;
    if (!employee_id) {
      return res.status(400).json({ error: 'No employee_id in token.' });
    }

    const challenge_id = req.body?.challenge_id;
    if (!challenge_id) {
      return res.status(400).json({ error: 'challenge_id is required.' });
    }

    // neutral_frame and action_frame from multer fields
    const neutralFile = req.files?.neutral_frame?.[0];
    const actionFile = req.files?.action_frame?.[0];

    if (!neutralFile || !actionFile) {
      return res.status(400).json({ error: 'neutral_frame and action_frame images are required.' });
    }

    // Magic byte checks
    if (!faceService.validateImageMagicBytes(neutralFile.buffer)) {
      return res.status(415).json({ error: 'INVALID_IMAGE_FORMAT' });
    }
    if (!faceService.validateImageMagicBytes(actionFile.buffer)) {
      return res.status(415).json({ error: 'INVALID_IMAGE_FORMAT' });
    }

    const intended_action = req.body?.intended_action || 'any';

    const result = await faceService.verify(
      employee_id,
      challenge_id,
      neutralFile.buffer,
      actionFile.buffer,
      intended_action
    );

    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (err.body) return res.status(status).json(err.body);
    console.error('[Face:verify]', err.message);
    return res.status(status).json({ error: err.message });
  }
}

module.exports = {
  getMyStatus,
  enrol,
  revoke,
  challenge,
  verifyFace,
};
