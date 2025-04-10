const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

router.post('/login', AuthController.login);
router.post('/verify-2fa', AuthController.verify2FA);
router.post('/resend-2fa', AuthController.resend2FA);
router.post('/refresh', AuthController.refreshToken);
router.post('/password-reset/initiate', AuthController.initiatePasswordReset);
router.post('/password-reset/verify', AuthController.verifyPasswordResetOTP);
router.post('/password-reset/reset', AuthController.resetPassword);

module.exports = router;