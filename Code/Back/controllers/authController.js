const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const AuthService = require('../services/authService');
const GoogleAuthService = require('../services/googleAuthService');
const NodeCache = require('node-cache');
const axios = require('axios');

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    USER_NOT_FOUND: 'Account not found.',
    INVALID_TOKEN: 'Session expired. Log in again.',
    SERVER_ERROR: 'Something broke. Try again later.',
    INVALID_CREDENTIALS: 'Wrong email or password.',
    GOOGLE_LOGIN_FAILED: 'Google login failed. Ensure your account is registered.',
};

class AuthController {
    static formatError(error) {
        const response = {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
        };
        if (error.waitTime) response.waitTime = error.waitTime;
        if (error.failureCount !== undefined) response.failureCount = error.failureCount;
        return response;
    }

    /**
     * Initiate Google OAuth login.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Redirects to Google OAuth URL.
     */
    static async initiateGoogleLogin(req, res) {
        try {
            const authUrl = await GoogleAuthService.getAuthUrl();
            logger.info(`Initiated Google OAuth login for user ${req.user?.userID || 'unknown'}, IP: ${req.ip}`);
            return res.redirect(authUrl);
        } catch (error) {
            logger.error(`Initiate Google OAuth error: ${error.message}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to initiate Google login' });
        }
    }

    /**
     * Handle Google OAuth callback.
     * @param {Object} req - Express request object with code and state in query.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with login result or error.
     */
    static async googleCallback(req, res) {
        try {
            // Set CORS headers to allow credentials
            res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
            res.setHeader('Access-Control-Allow-Credentials', 'true');

            const { code, state } = req.query;
            if (!code) {
                logger.warn('Google callback: Missing code parameter', { query: req.query, IP: req.ip });
                return res.redirect('http://localhost:5173/login?error=Missing+code+parameter');
            }

            const deviceIdentifier = req.headers['x-device-id'] || 'unknown-device';
            const result = await GoogleAuthService.googleLogin(code, deviceIdentifier, res);
            logger.info(`Google login successful for user ${result.user?.userID || 'unknown'}, IP: ${req.ip}`);

            // Log raw Set-Cookie headers
            const cookieHeaders = res.getHeader('Set-Cookie') || [];
            const userDataCookie = cookieHeaders.find(header => header.startsWith('userData='));
            logger.info('Cookies set in response', {
                cookies: cookieHeaders,
                userDataCookiePreview: userDataCookie ? userDataCookie.substring(0, 100) + '...' : 'Not found',
            });

            // Delay redirect to ensure cookies are sent
            setTimeout(() => {
                res.redirect('http://localhost:5173/?login=success');
            }, 100);
        } catch (error) {
            logger.error(`Google callback error: ${error.message}`, {
                status: error.status,
                stack: error.stack,
                query: req.query,
                IP: req.ip,
            });
            const errorMessage = encodeURIComponent(error.message || 'Google login failed');
            res.redirect(`http://localhost:5173/login?error=${errorMessage}`);
        }
    }

    /**
     * Handle user login.
     * @param {Object} req - Express request object with login credentials.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with login result or error.
     */
    static async login(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Login validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { identifier, password, deviceIdentifier, otpMethod } = req.body;
            if (!identifier || !password || !deviceIdentifier) {
                logger.warn('Missing login fields, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }

            const result = await AuthService.login(identifier, password, deviceIdentifier, otpMethod, res);
            logger.info(`Login successful for ${identifier}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Login error for ${req.body.identifier || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            const status = error.message === ERROR_MESSAGES.INVALID_CREDENTIALS ? 401 : 400;
            return res.status(status).json(AuthController.formatError(error));
        }
    }

    /**
     * Verify 2FA code.
     * @param {Object} req - Express request object with 2FA details.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with verification result or error.
     */
    static async verify2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`2FA validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken } = req.body;
            if (!userID || !otpCode || !deviceIdentifier || trustDevice === undefined || !tempToken || !refreshToken) {
                logger.warn('Missing 2FA fields, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }

            const cacheKey = `2fa_${userID}_${deviceIdentifier}`;
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) {
                return res.status(200).json(cachedResult);
            }

            const result = await AuthService.verify2FA(userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken, res);
            cache.set(cacheKey, result, 60);
            logger.info(`2FA verified for user ${userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`2FA verification error for ${req.body.userID || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    /**
     * Refresh access token.
     * @param {Object} req - Express request object with refresh token in cookies.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with new tokens or error.
     */
    static async refreshToken(req, res) {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                logger.warn('No refresh token provided, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.refreshToken(refreshToken, res);
            logger.info('Refresh token successful, IP: ${req.ip}');
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Refresh token error: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    /**
     * Log out user and invalidate Keycloak session.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with logout confirmation or error.
     */
    static async logout(req, res) {
        try {
            const refreshToken = req.cookies?.refreshToken;
            const cookieOptions = {
                path: '/',
                sameSite: process.env.NODE_ENV === 'development' ? 'Lax' : 'Strict',
                secure: process.env.NODE_ENV === 'production',
            };

            // Clear all cookies
            res.clearCookie('accessToken', cookieOptions);
            res.clearCookie('refreshToken', cookieOptions);
            res.clearCookie('userData', cookieOptions);
            logger.info('Cookies cleared on logout', { cookies: ['accessToken', 'refreshToken', 'userData'], IP: req.ip });

            // Invalidate Keycloak session using refresh token
            if (refreshToken) {
                const keycloakBaseUrl = `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}`;
                try {
                    await axios.post(
                        `${keycloakBaseUrl}/protocol/openid-connect/logout`,
                        new URLSearchParams({
                            client_id: process.env.KEYCLOAK_CLIENT_ID,
                            client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
                            refresh_token: refreshToken,
                        }),
                        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                    );
                    logger.info('Keycloak session invalidated', { IP: req.ip });
                } catch (keycloakError) {
                    logger.warn('Failed to invalidate Keycloak session', {
                        error: keycloakError.message,
                        IP: req.ip,
                    });
                    // Continue with logout even if Keycloak session invalidation fails
                }
            } else {
                logger.warn('No refreshToken found for Keycloak logout', { IP: req.ip });
            }

            // Construct Keycloak logout URL for frontend redirect
            const keycloakLogoutUrl = `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/protocol/openid-connect/logout?client_id=${process.env.KEYCLOAK_CLIENT_ID}&post_logout_redirect_uri=${encodeURIComponent('http://localhost:5173/login')}`;

            logger.info('User logged out successfully', { IP: req.ip });
            return res.status(200).json({
                message: 'Logged out successfully',
                keycloakLogoutUrl,
            });
        } catch (error) {
            logger.error(`Logout error: ${error.message}`, { IP: req.ip, stack: error.stack });
            return res.status(500).json({ error: error.message || 'Logout failed' });
        }
    }

    /**
     * Resend 2FA code.
     * @param {Object} req - Express request object with userID and otpMethod.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with resend result or error.
     */
    static async resend2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Resend 2FA validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, otpMethod } = req.body;
            if (!userID) {
                logger.warn('Missing userID for resend 2FA, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.resend2FA(userID, otpMethod);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Resend 2FA error for ${req.body.userID || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    /**
     * Initiate password reset.
     * @param {Object} req - Express request object with identifier.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with initiation result or error.
     */
    static async initiatePasswordReset(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Password reset init validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { identifier } = req.body;
            if (!identifier) {
                logger.warn('Missing identifier for password reset, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.initiatePasswordReset(identifier);
            logger.info(`Password reset initiated for ${identifier}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Password reset init error for ${req.body.identifier || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    /**
     * Verify password reset OTP.
     * @param {Object} req - Express request object with userID and otpCode.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with verification result or error.
     */
    static async verifyPasswordResetOTP(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Password reset OTP validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, otpCode } = req.body;
            if (!userID || !otpCode) {
                logger.warn('Missing fields for password reset OTP, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.verifyPasswordResetOTP(userID, otpCode);
            logger.info(`Password reset OTP verified for ${userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Password reset OTP error for ${req.body.userID || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    /**
     * Reset password.
     * @param {Object} req - Express request object with userID, newPassword, and tempToken.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with reset result or error.
     */
    static async resetPassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Password reset validation failed: ${JSON.stringify(errors.array())}, IP: ${req.ip}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, newPassword, tempToken } = req.body;
            if (!userID || !newPassword || !tempToken) {
                logger.warn('Missing fields for password reset, IP: ${req.ip}');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.resetPassword(userID, newPassword, tempToken);
            logger.info(`Password reset completed for ${userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Password reset error for ${req.body.userID || 'unknown'}: ${error.message}, IP: ${req.ip}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }
}

module.exports = AuthController;