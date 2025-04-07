const AuthService = require('../services/authService');
const otpService = require('../services/otpService');

class AuthController {
    static async login(req, res) {
        try {
            const { identifier, password, deviceIdentifier } = req.body;
            if (!identifier || !password || !deviceIdentifier) {
                return res.status(400).json({ error: 'Identifier, password, and device identifier are required' });
            }
            const result = await AuthService.login(identifier, password, deviceIdentifier);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Login failed:`, error);
            res.status(401).json({ error: error.message });
        }
    }

    static async verify2FA(req, res) {
        try {
            const { userID, otpCode, deviceIdentifier, trustDevice } = req.body;
            if (!userID || !otpCode || !deviceIdentifier) {
                return res.status(400).json({ error: 'User ID, OTP code, and device identifier are required' });
            }
            const result = await AuthService.verify2FA(userID, otpCode, deviceIdentifier, trustDevice);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - 2FA verification failed:`, error);
            res.status(401).json({ error: error.message });
        }
    }

    static async resend2FA(req, res) {
        try {
            const { userID } = req.body;
            if (!userID) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const result = await AuthService.resend2FA(userID);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Resend 2FA failed:`, error);
            res.status(500).json({ error: error.message });
        }
    }

    static async initiatePasswordReset(req, res) {
        try {
            const { identifier } = req.body;
            if (!identifier) {
                return res.status(400).json({ error: 'Email or phone is required' });
            }
            const result = await AuthService.initiatePasswordReset(identifier);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Password reset initiation failed:`, error);
            res.status(401).json({ error: error.message });
        }
    }

    static async verifyPasswordResetOTP(req, res) {
        try {
            const { userID, otpCode } = req.body;
            if (!userID || !otpCode) {
                return res.status(400).json({ error: 'User ID and OTP code are required' });
            }
            const result = await AuthService.verifyPasswordResetOTP(userID, otpCode);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Password reset OTP verification failed:`, error);
            res.status(401).json({ error: error.message });
        }
    }

    static async resetPassword(req, res) {
        try {
            const { userID, newPassword } = req.body;
            if (!userID || !newPassword) {
                return res.status(400).json({ error: 'User ID and new password are required' });
            }
            const result = await AuthService.resetPassword(userID, newPassword);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Password reset failed:`, error);
            res.status(401).json({ error: error.message });
        }
    }
}

module.exports = AuthController;