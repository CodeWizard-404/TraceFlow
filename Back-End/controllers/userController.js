const UserService = require('../services/userService');

class UserController {
    async createUser(req, res) {
        try {
            const { email, password, firstname, lastname, phone, wallet } = req.body;
            const user = await UserService.createUser(email, password, firstname, lastname, phone, wallet);
            res.status(201).json(user);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getAllUsers(req, res) {
        try {
            const users = await UserService.getAllUsers();
            res.status(200).json(users);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getIdByPhoneNumber(req, res) {
        try {
            const { phone } = req.body;
            const user = await UserService.getIdByPhoneNumber(phone);
            if (user) {
                res.status(200).json(user);
            } else {
                res.status(404).json({ error: 'User not found' });
            }
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: error.message });
        }
    }

    

    async getUserById(req, res) {
        try {
            const { userID } = req.params;
            const user = await UserService.getUserById(userID);
            res.status(200).json(user);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async updateUser(req, res) {
        try {
            const { userID } = req.params;
            const userData = req.body;
            const updatedUser = await UserService.updateUser(userID, userData);
            res.status(200).json(updatedUser);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async deleteUser(req, res) {
        try {
            const { userID } = req.params;
            const result = await UserService.deleteUser(userID);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async assignRolesToUser(req, res) {
        try {
            const { userID } = req.params;
            const { roleIDs } = req.body; // Array of role IDs
            const result = await UserService.assignRolesToUser(userID, roleIDs);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getRolesByUser(req, res) {
        try {
            const { userID } = req.params;
            const roles = await UserService.getRolesByUser(userID);
            res.status(200).json(roles);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }
}

module.exports = new UserController();