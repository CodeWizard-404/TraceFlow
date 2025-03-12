const AuthService = require('../services/authService');

class AuthController {
    // Login (User Story 38)
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await AuthService.login(email, password);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Verify 2FA (User Story 38)
    static async verify2FA(req, res) {
        try {
            const { userID, otpCode } = req.body;
            const result = await AuthService.verify2FA(userID, otpCode);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Create User (User Story 45)
    static async createUser(req, res) {
        try {
            const { firstname, lastname, email, password, phone, wallet, roleNames } = req.body;
            const user = await AuthService.createUser(firstname, lastname, email, password, phone, wallet, roleNames);
            res.status(201).json(user);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Get All Users (User Story 48)
    static async getAllUsers(req, res) {
        try {
            const users = await AuthService.getAllUsers();
            res.json(users);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Create Role (User Story 49)
    static async createRole(req, res) {
        try {
            const { name, description } = req.body;
            const role = await AuthService.createRole(name, description);
            res.status(201).json(role);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Get Role Details (User Story 52)
    static async getRoleDetails(req, res) {
        try {
            const { roleID } = req.params;
            const role = await AuthService.getRoleDetails(roleID);
            res.json(role);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Assign Roles to User (User Story 53)
    static async assignRolesToUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleNames } = req.body;
            const user = await AuthService.assignRolesToUser(userID, roleNames);
            res.json(user);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}

module.exports = AuthController;