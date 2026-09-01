/**
 * Sentinel — Auth Routes (Module 1: Melbin)
 * Mounts: /api/auth
 */

const router = require("express").Router();
const ctrl   = require("./controller");
const { requireAuth } = require("../../shared/middleware/auth.middleware");

router.post("/login",       ctrl.login);
router.post("/totp/setup",  requireAuth, ctrl.totpSetup);
router.post("/totp/verify", requireAuth, ctrl.totpVerify);
router.get("/me",           requireAuth, ctrl.me);
router.post("/logout",      ctrl.logout);

module.exports = router;
