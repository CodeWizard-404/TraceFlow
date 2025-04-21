const express = require('express');
const AuthController = require('../controllers/authController');
const { sensitiveLimiter, otpLimiter, refreshLimiter } = require('../middleware/rateLimit');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/login', sensitiveLimiter, AuthController.login);
router.post('/verify-2fa', sensitiveLimiter, AuthController.verify2FA);
router.post('/refresh', refreshLimiter, AuthController.refreshToken);
router.post('/resend-2fa', otpLimiter, AuthController.resend2FA);
router.post('/reset-password/init', otpLimiter, AuthController.initiatePasswordReset);
router.post('/reset-password/verify', sensitiveLimiter, AuthController.verifyPasswordResetOTP);
router.post('/reset-password', sensitiveLimiter, AuthController.resetPassword);
router.post('/logout', sensitiveLimiter, AuthController.logout);
router.get('/google-callback', sensitiveLimiter, AuthController.googleCallback);
module.exports = router;