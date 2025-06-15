const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { body } = require('express-validator');
const { authenticateCookie } = require('../config/security');
const { sensitiveLimiter, otpLimiter, refreshLimiter } = require('../config/rateLimit');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticates a user with an identifier (email or phone) and password, initiating 2FA if required. Rate-limited to 15 requests per 10 minutes.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *               - deviceIdentifier
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: User email or phone number
 *               password:
 *                 type: string
 *                 description: User password
 *               deviceIdentifier:
 *                 type: string
 *                 description: Unique device identifier
 *               otpMethod:
 *                 type: string
 *                 enum: [email, phone]
 *                 default: email
 *                 description: Preferred 2FA delivery method
 *             example:
 *               identifier: user@example.com
 *               password: Password123!
 *               deviceIdentifier: device-uuid-123
 *               otpMethod: email
 *     responses:
 *       200:
 *         description: Login successful or 2FA required
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         userID:
 *                           type: string
 *                         email:
 *                           type: string
 *                     expiresIn:
 *                       type: integer
 *                   example:
 *                     accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       userID: usr_123
 *                       email: user@example.com
 *                     expiresIn: 900000
 *                 - type: object
 *                   properties:
 *                     requires2FA:
 *                       type: boolean
 *                     userID:
 *                       type: string
 *                     deviceIdentifier:
 *                       type: string
 *                     tempToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     expiresIn:
 *                       type: integer
 *                     message:
 *                       type: string
 *                   example:
 *                     requires2FA: true
 *                     userID: usr_123
 *                     deviceIdentifier: device-uuid-123
 *                     tempToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     expiresIn: 900000
 *                     message: OTP sent to your email
 *       400:
 *         description: Missing required fields or invalid identifier
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account locked
 *       429:
 *         description: Too many attempts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 waitTime:
 *                   type: integer
 *               example:
 *                 error: Too many attempts. Please wait 10 minutes and try again.
 *                 waitTime: 600
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/auth/2fa/verify:
 *   post:
 *     summary: Verify 2FA OTP
 *     description: Verifies the 2FA OTP for a user, completing the login process. Rate-limited to 15 requests per 10 minutes.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userID
 *               - otpCode
 *               - deviceIdentifier
 *               - trustDevice
 *               - tempToken
 *               - refreshToken
 *             properties:
 *               userID:
 *                 type: string
 *                 description: User ID
 *               otpCode:
 *                 type: string
 *                 description: OTP code
 *               deviceIdentifier:
 *                 type: string
 *                 description: Unique device identifier
 *               trustDevice:
 *                 type: boolean
 *                 description: Whether to trust the device for 30 days
 *               tempToken:
 *                 type: string
 *                 description: Temporary access token from login
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token from login
 *             example:
 *               userID: usr_123
 *               otpCode: 123456
 *               deviceIdentifier: device-uuid-123
 *               trustDevice: true
 *               tempToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: 2FA verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requires2FA:
 *                   type: boolean
 *                 accessToken:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     userID:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           roleID:
 *                             type: string
 *                           name:
 *                             type: string
 *                           permissions:
 *                             type: array
 *                             items:
 *                               type: object
 *                 expiresIn:
 *                   type: integer
 *               example:
 *                 requires2FA: false
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   userID: usr_123
 *                   email: user@example.com
 *                   phone: +1234567890
 *                   roles: [{ roleID: "role_1", name: "Admin", permissions: [] }]
 *                 expiresIn: 900000
 *       400:
 *         description: Missing required fields or invalid OTP
 *       404:
 *         description: User not found
 *       429:
 *         description: Too many attempts
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Refreshes the access token using the refresh token stored in cookies. Rate-limited to 10 requests per 10 minutes.
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: integer
 *               example:
 *                 user:
 *                   message: Token refreshed
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 expiresIn: 900000
 *       400:
 *         description: Missing or invalid refresh token
 *       429:
 *         description: Too many refresh attempts
 *       500:
 *         description: Internal server error
 */
router.post('/refresh', refreshLimiter, AuthController.refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Logs out the user, clearing session and cookies.
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 keycloakLogoutUrl:
 *                   type: string
 *               example:
 *                 message: Logged out successfully
 *                 keycloakLogoutUrl: http://localhost:8080/realms/TraceFlow/protocol/openid-connect/logout...
 *       500:
 *         description: Internal server error
 */
router.post('/logout', AuthController.logout);

/**
 * @swagger
 * /api/auth/2fa/resend:
 *   post:
 *     summary: Resend 2FA OTP
 *     description: Resends the 2FA OTP to the user’s email or phone. Rate-limited to 5 requests per 10 minutes.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userID
 *             properties:
 *               userID:
 *                 type: string
 *                 description: User ID
 *               otpMethod:
 *                 type: string
 *                 enum: [email, phone]
 *                 default: email
 *                 description: Preferred OTP delivery method
 *             example:
 *               userID: usr_123
 *               otpMethod: email
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userID:
 *                   type: string
 *                 message:
 *                   type: string
 *               example:
 *                 userID: usr_123
 *                 message: OTP resent to your email
 *       400:
 *         description: Missing userID or no OTP method available
 *       404:
 *         description: User not found
 *       429:
 *         description: Too many OTP requests
 *       500:
 *         description: Internal server error
 */
router.post(
    '/2fa/resend',
    [body('userID').notEmpty().withMessage('User ID is required')],
    otpLimiter,
    AuthController.resend2FA
);

/**
 * @swagger
 * /api/auth/password/reset/initiate:
 *   post:
 *     summary: Initiate password reset
 *     description: Initiates a password reset by sending an OTP to the user’s email or phone.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: User email or phone number
 *             example:
 *               identifier: user@example.com
 *     responses:
 *       200:
 *         description: Password reset initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userID:
 *                   type: string
 *                 message:
 *                   type: string
 *               example:
 *                 userID: usr_123
 *                 message: OTP sent to your email
 *       400:
 *         description: Missing identifier or no OTP method available
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post(
    '/password/reset/initiate',
    [body('identifier').notEmpty().withMessage('Identifier is required')],
    AuthController.initiatePasswordReset
);

/**
 * @swagger
 * /api/auth/password/reset/verify:
 *   post:
 *     summary: Verify password reset OTP
 *     description: Verifies the OTP sent for password reset.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userID
 *               - otpCode
 *             properties:
 *               userID:
 *                 type: string
 *                 description: User ID
 *               otpCode:
 *                 type: string
 *                 description: OTP code
 *             example:
 *               userID: usr_123
 *               otpCode: 123456
 *     responses:
 *       200:
 *         description: OTP verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userID:
 *                   type: string
 *                 tempToken:
 *                   type: string
 *                 message:
 *                   type: string
 *               example:
 *                 userID: usr_123
 *                 tempToken: temp-token-123
 *                 message: OTP verified. Proceed to reset password.
 *       400:
 *         description: Missing fields or invalid OTP
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post(
    '/password/reset/verify',
    [
        body('userID').notEmpty().withMessage('User ID is required'),
        body('otpCode').notEmpty().withMessage('OTP code is required'),
    ],
    AuthController.verifyPasswordResetOTP
);

/**
 * @swagger
 * /api/auth/password/reset:
 *   post:
 *     summary: Reset password
 *     description: Resets the user’s password using the verified OTP and temporary token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userID
 *               - newPassword
 *               - tempToken
 *             properties:
 *               userID:
 *                 type: string
 *                 description: User ID
 *               newPassword:
 *                 type: string
 *                 description: New password
 *               tempToken:
 *                 type: string
 *                 description: Temporary token from OTP verification
 *             example:
 *               userID: usr_123
 *               newPassword: NewPassword123!
 *               tempToken: temp-token-123
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *               example:
 *                 message: Password reset successfully
 *       400:
 *         description: Missing fields or invalid tempToken
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post(
    '/password/reset',
    [
        body('userID').notEmpty().withMessage('User ID is required'),
        body('newPassword').notEmpty().withMessage('New password is required'),
        body('tempToken').notEmpty().withMessage('Temporary token is required'),
    ],
    AuthController.resetPassword
);

/**
 * @swagger
 * /api/auth/callback:
 *   get:
 *     summary: Google OAuth callback
 *     description: Handles the Google OAuth callback, exchanging the authorization code for tokens and redirecting to the frontend.
 *     tags: [Authentication]
 *     parameters:
 *       - name: code
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Google authorization code
 *       - name: state
 *         in: query
 *         schema:
 *           type: string
 *         description: State parameter
 *     responses:
 *       302:
 *         description: Redirects to frontend with success or error
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *             description: Redirect URL
 *             example: http://frontend-url/?login=success
 *       500:
 *         description: Internal server error
 */
router.get('/callback', AuthController.googleCallback);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Google ID token login
 *     description: Authenticates a user using a Google ID token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_token
 *             properties:
 *               id_token:
 *                 type: string
 *                 description: Google ID token
 *             example:
 *               id_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Google login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     userID:
 *                       type: string
 *                     email:
 *                       type: string
 *                     roles:
 *                       type: array
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: integer
 *               example:
 *                 user:
 *                   userID: usr_123
 *                   email: user@example.com
 *                   roles: [{ roleID: "role_1", name: "Admin" }]
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 expiresIn: 900000
 *       400:
 *         description: Missing or invalid ID token
 *       401:
 *         description: Google login failed
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/google', AuthController.googleIdTokenLogin);

/**
 * @swagger
 * /api/auth/google-calendar-auth:
 *   get:
 *     summary: Initiate Google Calendar authentication
 *     description: Redirects to Google for Calendar API authentication. Requires user authentication.
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       302:
 *         description: Redirects to Google auth URL
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *             description: Google auth URL
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/google-calendar-auth', authenticateCookie, AuthController.googleCalendarAuth);

/**
 * @swagger
 * /api/auth/google-calendar-auth/callback:
 *   get:
 *     summary: Google Calendar auth callback
 *     description: Handles the Google Calendar auth callback, storing tokens and redirecting to frontend. Requires user authentication.
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: code
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Google authorization code
 *       - name: state
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID as state parameter
 *     responses:
 *       302:
 *         description: Redirects to frontend with success or error
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *             description: Redirect URL
 *             example: http://frontend-url/?calendar=success
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/google-calendar-auth/callback', authenticateCookie, AuthController.googleCalendarCallback);

/**
 * @swagger
 * /api/auth/get-google-calendar-auth-url:
 *   get:
 *     summary: Get Google Calendar auth URL
 *     description: Retrieves the Google Calendar authentication URL. Requires user authentication.
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Auth URL retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authUrl:
 *                   type: string
 *               example:
 *                 authUrl: https://accounts.google.com/o/oauth2/v2/auth?client_id=...
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/get-google-calendar-auth-url', authenticateCookie, AuthController.getGoogleCalendarAuthUrl);

module.exports = router;