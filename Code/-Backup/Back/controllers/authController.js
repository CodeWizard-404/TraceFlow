// backend/controllers/authController.js

const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const AuthService = require('../services/authService');
const NodeCache = require('node-cache');

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

    static async googleCallback(req, res) {
        try {
            const { code, state } = req.query;
            if (!code) {
                logger.warn('Google callback: Missing code parameter', { query: req.query });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const deviceIdentifier = req.headers['x-device-id'] || 'unknown-device';
            const result = await AuthService.googleLogin(code, deviceIdentifier, res);
            logger.info(`Google login successful for user ${result.user?.userID || 'unknown'}`, { userID: result.user?.userID });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Google callback error: ${error.message}`, {
                status: error.status,
                stack: error.stack,
                query: req.query,
            });
            return res.status(error.status || 400).json(AuthController.formatError(error));
        }
    }


    static async login(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Login validation failed: ${JSON.stringify(errors.array())}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { identifier, password, deviceIdentifier, otpMethod } = req.body;
            if (!identifier || !password || !deviceIdentifier) {
                logger.warn('Missing login fields');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }

            const result = await AuthService.login(identifier, password, deviceIdentifier, otpMethod, res);
            logger.info(`Login successful for ${identifier}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Login error for ${req.body.identifier || 'unknown'}: ${error.message}`);
            const status = error.message === ERROR_MESSAGES.INVALID_CREDENTIALS ? 401 : 400;
            return res.status(status).json(AuthController.formatError(error));
        }
    }

    static async verify2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`2FA validation failed: ${JSON.stringify(errors.array())}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken } = req.body;
            if (!userID || !otpCode || !deviceIdentifier || trustDevice === undefined || !tempToken || !refreshToken) {
                logger.warn('Missing 2FA fields');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }

            const cacheKey = `2fa_${userID}_${deviceIdentifier}`;
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) {
                return res.status(200).json(cachedResult);
            }

            const result = await AuthService.verify2FA(userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken, res);
            cache.set(cacheKey, result, 60);
            logger.info(`2FA verified for user ${userID}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`2FA verification error for ${req.body.userID || 'unknown'}: ${error.message}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    static async refreshToken(req, res) {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                logger.warn('No refresh token provided');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.refreshToken(refreshToken, res);
            logger.info('Refresh token successful');
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Refresh token error: ${error.message}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    static async logout(req, res) {
        try {
            const cookieOptions = {
                path: '/',
                sameSite: process.env.NODE_ENV === 'development' ? 'Lax' : 'Strict',
                secure: process.env.NODE_ENV === 'production',
            };
            res.clearCookie('accessToken', cookieOptions);
            res.clearCookie('refreshToken', cookieOptions);
            logger.info('User logged out, cookies cleared');
            return res.status(200).json({ message: 'Logged out successfully' });
        } catch (error) {
            logger.error(`Logout error: ${error.message}`);
            return res.status(500).json(AuthController.formatError(error));
        }
    }

    static async resend2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Resend 2FA validation failed: ${JSON.stringify(errors.array())}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, otpMethod } = req.body;
            if (!userID) {
                logger.warn('Missing userID for resend 2FA');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.resend2FA(userID, otpMethod);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Resend 2FA error for ${req.body.userID || 'unknown'}: ${error.message}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    static async initiatePasswordReset(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Password reset init validation failed: ${JSON.stringify(errors.array())}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { identifier } = req.body;
            if (!identifier) {
                logger.warn('Missing identifier for password reset');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.initiatePasswordReset(identifier);
            logger.info(`Password reset initiated for ${identifier}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Password reset init error for ${req.body.identifier || 'unknown'}: ${error.message}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    static async verifyPasswordResetOTP(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Password reset OTP validation failed: ${JSON.stringify(errors.array())}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, otpCode } = req.body;
            if (!userID || !otpCode) {
                logger.warn('Missing fields for password reset OTP');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.verifyPasswordResetOTP(userID, otpCode);
            logger.info(`Password reset OTP verified for ${userID}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Password reset OTP error for ${req.body.userID || 'unknown'}: ${error.message}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    static async resetPassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn(`Password reset validation failed: ${JSON.stringify(errors.array())}`);
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS, details: errors.array() });
            }

            const { userID, newPassword, tempToken } = req.body;
            if (!userID || !newPassword || !tempToken) {
                logger.warn('Missing fields for password reset');
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.resetPassword(userID, newPassword, tempToken);
            logger.info(`Password reset completed for ${userID}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Password reset error for ${req.body.userID || 'unknown'}: ${error.message}`);
            return res.status(400).json(AuthController.formatError(error));
        }
    }
}

module.exports = AuthController;