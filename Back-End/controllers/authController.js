// controllers/authController.js
const AuthService = require('../services/authService');

class AuthController {
    static async login(req, res) {

        console.log('login', req.body);
        try {
            const { identifier, password } = req.body;
            if (!identifier || !password) {
                return res.status(400).json({ error: 'Identifier and password are required' });
            }
            const result = await AuthService.login(identifier, password);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Login failed:`, error);
            res.status(401).json({ error: error.message || 'Login failed: Invalid credentials' });
        }
    }

    static async verify2FA(req, res) {

        console.log('verify2FA', req.body);
        try {
            const { userID, otpCode } = req.body;
            if (!userID || !otpCode) {
                return res.status(400).json({ error: 'User ID and OTP code are required' });
            }
            const result = await AuthService.verify2FA(userID, otpCode);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - 2FA verification failed:`, error);
            res.status(401).json({ error: error.message || '2FA verification failed: Invalid or expired OTP' });
        }
    }

    static async resend2FA(req, res) {

        console.log('resend2FA', req.body);
        try {
            const { userID } = req.body;
            if (!userID) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const result = await AuthService.resend2FA(userID);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Resend 2FA failed:`, error);
            res.status(401).json({ error: error.message || 'Failed to resend 2FA code due to an internal error' });
        }
    }
}

module.exports = AuthController;