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
};

class AuthController {
    static formatError(error) {
        return {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
        };
    }

    static async login(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { identifier, password, deviceIdentifier, otpMethod } = req.body;
            if (!identifier || !password || !deviceIdentifier) {
                return res.status(400).json(this.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }

            const result = await AuthService.login(identifier, password, deviceIdentifier, otpMethod, res);
            logger.info(`Login attempt for ${identifier}, requires2FA: ${result.requires2FA || false}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Login error for ${req.body.identifier || 'unknown'}: ${error.message}`);
            return res.status(400).json(this.formatError(error));
        }
    }

    static async verify2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken } = req.body;
            if (!userID || !otpCode || !deviceIdentifier || trustDevice === undefined || !tempToken || !refreshToken) {
                return res.status(400).json(this.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
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
            return res.status(400).json(this.formatError(error));
        }
    }

    static async refreshToken(req, res) {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                return res.status(400).json(this.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.refreshToken(refreshToken, res);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Refresh token error: ${error.message}`);
            return res.status(400).json(this.formatError(error));
        }
    }

    static async logout(req, res) {
        try {
            res.clearCookie('accessToken', { path: '/', sameSite: 'Lax', secure: false });
            res.clearCookie('refreshToken', { path: '/', sameSite: 'Lax', secure: false });
            return res.status(200).json({ message: 'Logged out successfully' });
        } catch (error) {
            logger.error(`Logout error: ${error.message}`);
            return res.status(500).json(this.formatError(error));
        }
    }

    static async resend2FA(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { userID, otpMethod } = req.body;
            if (!userID) {
                return res.status(400).json(this.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.resend2FA(userID, otpMethod);
            return res.json(result);
        } catch (error) {
            logger.error(`Resend 2FA error for ${req.body.userID || 'unknown'}: ${error.message}`);
            return res.status(400).json(this.formatError(error));
        }
    }

    static async initiatePasswordReset(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { identifier } = req.body;
            if (!identifier) {
                return res.status(400).json(this.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.initiatePasswordReset(identifier);
            return res.json(result);
        } catch (error) {
            logger.error(`Password reset init error for ${req.body.identifier || 'unknown'}: ${error.message}`);
            return res.status(400).json(this.formatError(error));
        }
    }

    static async verifyPasswordResetOTP(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { userID, otpCode } = req.body;
            if (!userID || !otpCode) {
                return res.status(400).json(this.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.verifyPasswordResetOTP(userID, otpCode);
            return res.json(result);
        } catch (error) {
            logger.error(`Password reset OTP error for ${req.body.userID || 'unknown'}: ${error.message}`);
            return res.status(400).json(this.formatError(error));
        }
    }

    static async resetPassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { userID, newPassword, tempToken } = req.body;
            if (!userID || !newPassword || !tempToken) {
                return res.status(400).json(this.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.resetPassword(userID, newPassword, tempToken);
            return res.json(result);
        } catch (error) {
            logger.error(`Password reset error for ${req.body.userID || 'unknown'}: ${error.message}`);
            return res.status(400).json(this.formatError(error));
        }
    }
}

module.exports = AuthController;