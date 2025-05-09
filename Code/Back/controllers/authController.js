// Importing required dependencies
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const AuthService = require('../services/authService');
const GoogleAuthService = require('../services/googleAuthService');
const NodeCache = require('node-cache');
const axios = require('axios');

// Initializing cache for 2FA verification
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Error message constants for consistent responses
const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    USER_NOT_FOUND: 'Account not found.',
    INVALID_TOKEN: 'Session expired. Log in again.',
    SERVER_ERROR: 'Something broke. Try again later.',
    INVALID_CREDENTIALS: 'Wrong email or password.',
    GOOGLE_LOGIN_FAILED: 'Google login failed. Ensure your account is registered.',
};

class AuthController {
    // Formats error responses consistently
    static formatError(error) {
        const response = {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
        };
        if (error.waitTime) response.waitTime = error.waitTime;
        if (error.failureCount !== undefined) response.failureCount = error.failureCount;
        return response;
    }

    // Handles Google OAuth callback
    static async googleCallback(req, res) {
        try {
            res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
            res.setHeader('Access-Control-Allow-Credentials', 'true');

            const { code, state } = req.query;
            if (!code) throw new Error('Missing code parameter');

            const result = await GoogleAuthService.googleLogin(code, res);
            const response = { redirect: `${process.env.FRONTEND_URL}/?login=success` };

            // Log success with structured fields
            logger.info('Google login completed successfully', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 302,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: result.user?.userID || null,
                metadata: {
                    redirectUrl: response.redirect.substring(0, 100),
                    userEmail: result.user?.email ? logger.sensitive(result.user.email) : null
                }
            });

            setTimeout(() => {
                res.redirect(`${process.env.FRONTEND_URL}/?login=success`);
            }, 100);
        } catch (error) {
            const errorMessage = encodeURIComponent(error.message || 'Google login failed');

            // Log error with structured fields
            logger.error('Google login callback failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 302,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: null,
                metadata: { error: errorMessage }
            });

            res.redirect(`${process.env.FRONTEND_URL}/login?error=${errorMessage}`);
        }
    }

    // Handles user login
    static async login(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { identifier, password, deviceIdentifier, otpMethod } = req.body;
            if (!identifier || !password || !deviceIdentifier) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            // Check for recent duplicate request
            const cacheKey = `login_${req.traceId}_${deviceIdentifier}`;
            if (cache.get(cacheKey)) {
                throw new Error('Duplicate login request detected');
            }
            cache.set(cacheKey, true, 10); // Cache for 10 seconds

            const result = await AuthService.login(identifier, password, deviceIdentifier, otpMethod, res);

            // Log success with structured fields, encrypting email
            logger.info('User login successful', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: result.user?.userID || null,
                sensitiveFields: ['email'],
                metadata: {
                    requires2FA: result.requires2FA,
                    email: result.user?.email || null
                }
            });

            return res.status(200).json(result);
        } catch (error) {
            const status = error.message === ERROR_MESSAGES.INVALID_CREDENTIALS ? 401 : 400;
            const response = AuthController.formatError(error);

            // Log error with structured fields
            logger.error('User login failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.userID || null,
                metadata: { error: response.error }
            });

            return res.status(status).json(response);
        }
    }

    // Verifies 2FA codes
    static async verify2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken } = req.body;
            if (!userID || !otpCode || !deviceIdentifier || trustDevice === undefined || !tempToken || !refreshToken) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }

            const cacheKey = `2fa_${userID}_${deviceIdentifier}`;
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) return res.status(200).json(cachedResult);

            const result = await AuthService.verify2FA(userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken, res);
            cache.set(cacheKey, result, 60);

            // Log success with structured fields
            logger.info('2FA verification successful', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: userID,
                metadata: {
                    email: result.user?.email ? logger.sensitive(result.user.email) : null,
                    trustDevice
                }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            // Log error with structured fields
            logger.error('2FA verification failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.body.userID || null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }

    // Refreshes authentication tokens
    static async refreshToken(req, res) {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const result = await AuthService.refreshToken(refreshToken, res);

            // Log success with structured fields
            logger.info('Token refresh successful', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: result.user?.userID || null,
                metadata: { message: result.user?.message }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            // Log error with structured fields
            logger.error('Token refresh failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }

    // Handles user logout
    static async logout(req, res) {
        try {
            const refreshToken = req.cookies?.refreshToken;
            const result = await AuthService.logout(refreshToken);

            const cookieOptions = {
                path: '/',
                sameSite: process.env.NODE_ENV === 'development' ? 'Lax' : 'Strict',
                secure: process.env.NODE_ENV === 'production',
            };

            result.cookiesToClear.forEach(cookie => {
                res.clearCookie(cookie, cookieOptions);
            });

            const response = {
                message: result.message,
                keycloakLogoutUrl: result.keycloakLogoutUrl,
            };

            // Log success with structured fields
            logger.info('User logout successful', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: null, // User ID not available after logout
                metadata: { message: response.message }
            });

            return res.status(200).json(response);
        } catch (error) {
            const response = { error: error.message || 'Logout failed' };

            // Log error with structured fields
            logger.error('User logout failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 500,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: null,
                metadata: { error: response.error }
            });

            return res.status(500).json(response);
        }
    }

    // Resends 2FA codes
    static async resend2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { userID, otpMethod } = req.body;
            if (!userID) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const result = await AuthService.resend2FA(userID, otpMethod);

            // Log success with structured fields
            logger.info('2FA code resent successfully', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: userID,
                metadata: { message: result.message }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            // Log error with structured fields
            logger.error('2FA code resend failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.body.userID || null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }

    // Initiates password reset process
    static async initiatePasswordReset(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { identifier } = req.body;
            if (!identifier) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const result = await AuthService.initiatePasswordReset(identifier);

            // Log success with structured fields
            logger.info('Password reset initiated successfully', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: result.userID,
                metadata: { message: result.message }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            // Log error with structured fields
            logger.error('Password reset initiation failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }

    // Verifies password reset OTP
    static async verifyPasswordResetOTP(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { userID, otpCode } = req.body;
            if (!userID || !otpCode) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const result = await AuthService.verifyPasswordResetOTP(userID, otpCode);

            // Log success with structured fields
            logger.info('Password reset OTP verified successfully', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: userID,
                metadata: { message: result.message }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            // Log error with structured fields
            logger.error('Password reset OTP verification failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.body.userID || null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }

    // Completes password reset
    static async resetPassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const { userID, newPassword, tempToken } = req.body;
            if (!userID || !newPassword || !tempToken) throw new Error(ERROR_MESSAGES.MISSING_FIELDS);

            const result = await AuthService.resetPassword(userID, newPassword, tempToken);

            // Log success with structured fields
            logger.info('Password reset completed successfully', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: userID,
                metadata: { message: result.message }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AuthController.formatError(error);

            // Log error with structured fields
            logger.error('Password reset failed', {
                traceId: req.traceId,
                route: 'auth',
                service: 'api',
                status: 400,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.body.userID || null,
                metadata: { error: response.error }
            });

            return res.status(400).json(response);
        }
    }
}

module.exports = AuthController;