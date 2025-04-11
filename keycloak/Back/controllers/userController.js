const UserService = require('../services/userService');
const { uploadPFP } = require('../config/multer');

class UserController {
    static async createUser(req, res) {
        console.log('Received request to create user:', req.body);
        try {
            const { email, password, firstname, lastname, phone, wallet } = req.body;
            if (!email || !password || !firstname || !lastname || !phone || !wallet) {
                return res.status(400).json({ error: 'Please fill in all required fields' });
            }
            const user = await UserService.createUser(email, password, firstname, lastname, phone, wallet);
            res.status(201).json(user);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Create user failed:`, error);
            res.status(400).json({ error: error.message });
        }
    }

    static async getAllUsers(req, res) {
        console.log('Received request to get all users');
        try {
            const users = await UserService.getAllUsers();
            res.status(200).json(users);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all users failed:`, error);
            res.status(500).json({ error: error.message });
        }
    }

    static async getUserByPhoneNumber(req, res) {
        console.log('Received request to get user by phone number', req.params);
        try {
            const { phone } = req.params;
            if (!phone) return res.status(400).json({ error: 'Phone number is required' });
            const user = await UserService.getUserByPhoneNumber(phone);
            res.status(200).json(user);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get user by phone failed:`, error);
            res.status(404).json({ error: error.message });
        }
    }

    static async getUsersByRole(req, res) {
        console.log('Received request to get users by role', req.params);
        try {
            const { role } = req.params;
            if (!role) return res.status(400).json({ error: 'Role is required' });
            const users = await UserService.getUsersByRole(role);
            res.status(200).json(users);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get users by role failed:`, error);
            res.status(500).json({ error: error.message });
        }
    }

    static async getUserById(req, res) {
        console.log('Received request to get user by ID', req.params);
        try {
            const { userID } = req.params;
            if (!userID) return res.status(400).json({ error: 'User ID is required' });
            const user = await UserService.getUserById(userID);
            res.status(200).json(user);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get user by ID failed:`, error);
            res.status(404).json({ error: error.message });
        }
    }

    static async updateUser(req, res) {
        console.log('Received request to update user', req.params, req.body, req.file);
        try {
            const { userID } = req.params;
            const userData = req.body;
            if (!userID) return res.status(400).json({ error: 'User ID is required' });
            if (req.file) userData.PFP = req.file.buffer;
            const updatedUser = await UserService.updateUser(userID, userData);
            res.status(200).json(updatedUser);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update user failed:`, error);
            res.status(400).json({ error: error.message });
        }
    }

    static async getProfile(req, res) {
        console.log('Received request to get profile', req.user);
        try {
            const userID = req.user.userID;
            if (!userID) return res.status(401).json({ error: 'Unauthorized: User ID not found in token' });
            const user = await UserService.getUserById(userID);
            const responseUser = user.toJSON();
            if (responseUser.PFP) responseUser.PFP = responseUser.PFP.toString('base64');
            res.status(200).json(responseUser);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get profile failed:`, error);
            res.status(400).json({ error: error.message });
        }
    }

    static async updateProfile(req, res) {
        console.log('Received request to update profile', {
            body: req.body,
            file: req.file ? { mimetype: req.file.mimetype, size: req.file.size } : null,
        });
        try {
            const userID = req.user.userID;
            const userData = req.body;
            if (!userID) return res.status(401).json({ error: 'Unauthorized: User ID not found in token' });

            // Validate file if provided
            if (req.file) {
                if (req.file.mimetype.startsWith('image/')) {
                    userData.PFP = req.file.buffer;
                } else {
                    return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
                }
            }

            const updatedUser = await UserService.updateUser(userID, userData);
            const responseUser = updatedUser.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            } else {
                delete responseUser.PFP; // Avoid sending null/undefined PFP
            }
            res.status(200).json(responseUser);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update profile failed:`, error);
            res.status(400).json({ error: error.message });
        }
    }

    static async deleteUser(req, res) {
        console.log('Received request to delete user', req.params);
        try {
            const { userID } = req.params;
            if (!userID) return res.status(400).json({ error: 'User ID is required' });
            const result = await UserService.deleteUser(userID);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Delete user failed:`, error);
            res.status(400).json({ error: error.message });
        }
    }

    static async assignSupervisorsToManager(req, res) {
        console.log('Received request to assign supervisors to manager', req.body);
        try {
            const { managerID, supervisorIDs } = req.body;
            if (!managerID || !Array.isArray(supervisorIDs)) return res.status(400).json({ error: 'Manager ID and supervisor IDs array are required' });
            const result = await UserService.assignSupervisorsToManager(managerID, supervisorIDs);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Assign supervisors failed:`, error);
            res.status(400).json({ error: error.message });
        }
    }

    static async revokeSupervisorsFromManager(req, res) {
        console.log('Received request to revoke supervisors from manager', req.body);
        try {
            const { managerID, supervisorIDs } = req.body;
            if (!managerID || !Array.isArray(supervisorIDs)) return res.status(400).json({ error: 'Manager ID and supervisor IDs array are required' });
            const result = await UserService.revokeSupervisorsFromManager(managerID, supervisorIDs);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Revoke supervisors failed:`, error);
            res.status(400).json({ error: error.message });
        }
    }

    static async getSupervisorsByUser(req, res) {
        console.log('Received request to get supervisors by user', req.params);
        try {
            const { userID } = req.params;
            if (!userID) return res.status(400).json({ error: 'User ID is required' });
            const supervisors = await UserService.getSupervisorsByUser(userID);
            res.status(200).json(supervisors);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get supervisors failed:`, error);
            res.status(404).json({ error: error.message });
        }
    }

    static async getManagersByUser(req, res) {
        console.log('Received request to get managers by user', req.params);
        try {
            const { userID } = req.params;
            if (!userID) return res.status(400).json({ error: 'User ID is required' });
            const managers = await UserService.getManagersByUser(userID);
            res.status(200).json(managers);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get managers failed:`, error);
            res.status(404).json({ error: error.message });
        }
    }
}

module.exports = UserController;