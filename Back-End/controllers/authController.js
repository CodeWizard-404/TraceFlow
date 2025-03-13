const AuthService = require('../services/authService');

class AuthController {
    static async login(req, res) {
        try {
            const { identifier, password } = req.body; 
            const result = await AuthService.login(identifier, password);
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    }

    static async verify2FA(req, res) {
        try {
            const { userID, otpCode } = req.body;
            const result = await AuthService.verify2FA(userID, otpCode);
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    }
    
    static async resend2FA(req, res) {
        try {
            const { userID } = req.body;
            const result = await AuthService.resend2FA(userID);
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    }

}

module.exports = AuthController;