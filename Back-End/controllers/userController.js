// controllers/userController.js
const UserService = require('../services/userService');

class UserController {
    static async createUser(req, res) {
        try {
            const { email, password, firstname, lastname, phone, wallet } = req.body;
            if (!email || !password || !firstname || !lastname || !phone || !wallet) {
                return res.status(400).json({ error: 'All fields (email, password, firstname, lastname, phone, wallet) are required' });
            }
            const user = await UserService.createUser(email, password, firstname, lastname, phone, wallet);
            res.status(201).json(user);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Create user failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to create user due to an internal error' });
        }
    }

    static async getAllUsers(req, res) {
        try {
            const users = await UserService.getAllUsers();
            res.status(200).json(users);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all users failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve users due to an internal error' });
        }
    }

    static async getIdByPhoneNumber(req, res) {
        try {
            const { phone } = req.body;
            if (!phone) {
                return res.status(400).json({ error: 'Phone number is required' });
            }
            const user = await UserService.getIdByPhoneNumber(phone);
            res.status(200).json(user);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get user ID by phone failed:`, error);
            res.status(404).json({ error: error.message || 'User not found by phone number' });
        }
    }

    static async getUserById(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const user = await UserService.getUserById(userID);
            res.status(200).json(user);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get user by ID failed:`, error);
            res.status(404).json({ error: error.message || 'User not found' });
        }
    }

    static async updateUser(req, res) {
        try {
            const { userID } = req.params;
            const userData = req.body;
            if (!userID) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const updatedUser = await UserService.updateUser(userID, userData);
            res.status(200).json(updatedUser);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update user failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to update user due to an internal error' });
        }
    }

    static async deleteUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const result = await UserService.deleteUser(userID);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Delete user failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to delete user due to an internal error' });
        }
    }

    static async assignRolesToUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body;
            if (!userID || !Array.isArray(roleIDs)) {
                return res.status(400).json({ error: 'User ID and role IDs array are required' });
            }
            const result = await UserService.assignRolesToUser(userID, roleIDs);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Assign roles to user failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to assign roles to user due to an internal error' });
        }
    }

    static async getRolesByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const roles = await UserService.getRolesByUser(userID);
            res.status(200).json(roles);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get roles by user failed:`, error);
            res.status(404).json({ error: error.message || 'User not found' });
        }
    }

    static async assignSupervisorsToManager(req, res) {
        try {
            const { managerID, supervisorIDs } = req.body;
            if (!managerID || !Array.isArray(supervisorIDs)) {
                return res.status(400).json({ error: 'Manager ID and supervisor IDs array are required' });
            }
            const result = await UserService.assignSupervisorsToManager(managerID, supervisorIDs);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Assign supervisors to manager failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to assign supervisors to manager due to an internal error' });
        }
    }
}

module.exports = UserController;