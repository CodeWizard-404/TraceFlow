// controllers/authController.js
const AuthService = require('../services/authService');

const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    USER_NOT_FOUND: 'Account not found.',
    INVALID_TOKEN: 'Session expired. Log in again.',
    SERVER_ERROR: 'Something broke. Try again later.',
};

class AuthController {
    // Helper to format error responses
    static formatError(error) {
        return {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
        };
    }

    // Login
    static async login(req, res) {
        try {
            const { identifier, password, deviceIdentifier, otpMethod } = req.body;
            if (!identifier || !password || !deviceIdentifier) {
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.login(identifier, password, deviceIdentifier, otpMethod);
            return res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Login error:`, error.message);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    // Verify 2FA
    static async verify2FA(req, res) {
        try {
            const { userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken } = req.body;
            if (!userID || !otpCode || !deviceIdentifier || !tempToken || !refreshToken) {
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.verify2FA(
                userID,
                otpCode,
                deviceIdentifier,
                trustDevice,
                tempToken,
                refreshToken
            );
            return res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - 2FA error:`, error.message);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    // Refresh token
    static async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.refreshToken(refreshToken);
            return res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Refresh error:`, error.message);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    // Resend 2FA
    static async resend2FA(req, res) {
        try {
            const { userID, otpMethod } = req.body;
            if (!userID) {
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.resend2FA(userID, otpMethod);
            return res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Resend 2FA error:`, error.message);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    // Initiate password reset
    static async initiatePasswordReset(req, res) {
        try {
            const { identifier } = req.body;
            if (!identifier) {
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.initiatePasswordReset(identifier);
            return res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Reset init error:`, error.message);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    // Verify password reset OTP
    static async verifyPasswordResetOTP(req, res) {
        try {
            const { userID, otpCode } = req.body;
            if (!userID || !otpCode) {
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.verifyPasswordResetOTP(userID, otpCode);
            return res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Reset OTP error:`, error.message);
            return res.status(400).json(AuthController.formatError(error));
        }
    }

    // Reset password
    static async resetPassword(req, res) {
        try {
            const { userID, newPassword } = req.body;
            if (!userID || !newPassword) {
                return res.status(400).json(AuthController.formatError(new Error(ERROR_MESSAGES.MISSING_FIELDS)));
            }
            const result = await AuthService.resetPassword(userID, newPassword);
            return res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Reset error:`, error.message);
            return res.status(400).json(AuthController.formatError(error));
        }
    }
}

module.exports = AuthController;