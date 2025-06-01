const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { body } = require('express-validator');
const { authenticateCookie } = require('../config/security');
const { sensitiveLimiter, otpLimiter, refreshLimiter } = require('../config/rateLimit');


// Routes for authentication
router.post(
    '/login',
    [
        body('identifier').notEmpty().withMessage('Identifier is required'),
        body('password').notEmpty().withMessage('Password is required'),
        body('deviceIdentifier').notEmpty().withMessage('Device identifier is required'),
    ],
    sensitiveLimiter,
    AuthController.login
);
router.post(
    '/2fa/verify',
    [
        body('userID').notEmpty().withMessage('User ID is required'),
        body('otpCode').notEmpty().withMessage('OTP code is required'),
        body('deviceIdentifier').notEmpty().withMessage('Device identifier is required'),
        body('trustDevice').isBoolean().withMessage('Trust device must be a boolean'),
        body('tempToken').notEmpty().withMessage('Temporary token is required'),
        body('refreshToken').notEmpty().withMessage('Refresh token is required'),
    ],
    sensitiveLimiter,
    AuthController.verify2FA
);
router.post('/refresh', refreshLimiter, AuthController.refreshToken);
router.post('/logout', AuthController.logout);
router.post(
    '/2fa/resend',
    [body('userID').notEmpty().withMessage('User ID is required')],
    otpLimiter,
    AuthController.resend2FA
);
router.post(
    '/password/reset/initiate',
    [body('identifier').notEmpty().withMessage('Identifier is required')],
    AuthController.initiatePasswordReset
);
router.post(
    '/password/reset/verify',
    [
        body('userID').notEmpty().withMessage('User ID is required'),
        body('otpCode').notEmpty().withMessage('OTP code is required'),
    ],
    AuthController.verifyPasswordResetOTP
);
router.post(
    '/password/reset',
    [
        body('userID').notEmpty().withMessage('User ID is required'),
        body('newPassword').notEmpty().withMessage('New password is required'),
        body('tempToken').notEmpty().withMessage('Temporary token is required'),
    ],
    AuthController.resetPassword
);

// Google OAuth routes
router.get('/callback', AuthController.googleCallback);

router.get('/google-calendar-auth', authenticateCookie, AuthController.googleCalendarAuth);
router.get('/google-calendar-auth/callback', authenticateCookie, AuthController.googleCalendarCallback);
router.get('/get-google-calendar-auth-url', authenticateCookie, AuthController.getGoogleCalendarAuthUrl);


module.exports = router;