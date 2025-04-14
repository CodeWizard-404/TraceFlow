const express = require('express');
const AuthController = require('../controllers/authController');
const { sensitiveLimiter, otpLimiter, refreshLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', sensitiveLimiter, AuthController.login);
router.post('/verify-2fa', sensitiveLimiter, AuthController.verify2FA);
router.post('/refresh', refreshLimiter, AuthController.refreshToken);
router.post('/resend-2fa', otpLimiter, AuthController.resend2FA);
router.post('/password-reset/initiate', otpLimiter, AuthController.initiatePasswordReset);
router.post('/password-reset/verify', sensitiveLimiter, AuthController.verifyPasswordResetOTP);
router.post('/password-reset/reset', sensitiveLimiter, AuthController.resetPassword);
router.post('/logout', (req, res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
});

module.exports = router;