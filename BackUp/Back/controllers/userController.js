// controllers/userController.js
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
        console.log('Received request to get all users', true);
        try {
            const users = await UserService.getAllUsers();
            res.status(200).json(users);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all users failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve users due to an internal error' });
        }
    }

    static async getUserByPhoneNumber(req, res) {
        console.log('Received request to get user by phone number', req.params);
        try {
            const { phone } = req.params;
            if (!phone) {
                return res.status(400).json({ error: 'Phone number is required' });
            }
            const user = await UserService.getUserByPhoneNumber(phone);
            res.status(200).json(user);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get user by phone failed:`, error);
            res.status(404).json({ error: error.message || 'User not found by phone number' });
        }
    }

    static async getUsersByRole(req, res) {
        console.log('Received request to get users by role', req.params);
        try {
            const { role } = req.params;
            if (!role) {
                return res.status(400).json({ error: 'Role is required' });
            }
            const users = await UserService.getUsersByRole(role);
            res.status(200).json(users);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get users by role failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve users by role due to an internal error' });
        }
    }

    static async getUserById(req, res) {
        console.log('Received request to get user by ID', req.params);
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
        console.log('Received request to update user', req.params, req.body, req.file);
        try {
            const { userID } = req.params;
            const userData = req.body;

            if (!userID) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            if (req.file) {
                userData.PFP = req.file.buffer;
            }

            const updatedUser = await UserService.updateUser(userID, userData);
            res.status(200).json(updatedUser);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update user failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to update user due to an internal error' });
        }
    }

    // get profile data
    static async getProfile(req, res) {
        console.log("Received request to get profile", req.user);
        try {
            const userID = req.user.userID;
            if (!userID) {
                return res.status(401).json({ error: "Unauthorized: User ID not found in token" });
            }

            console.log("User ID from token:", userID);
            const user = await UserService.getUserById(userID);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            // Prepare response with base64-encoded PFP
            const responseUser = {
                ...user.toJSON(), // Convert Sequelize instance to plain object
            };
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString("base64"); // Convert buffer to base64 string
            }

            res.status(200).json(responseUser);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get profile failed:`, error);
            res.status(400).json({ error: error.message || "Failed to get profile due to an internal error" });
        }
    }

    static async updateProfile(req, res) {
        console.log("Received request to update profile", req.body, req.file);
        try {
            const userID = req.user.userID;
            const userData = req.body;

            if (!userID) {
                return res.status(401).json({ error: "Unauthorized: User ID not found in token" });
            }

            if (req.file) {
                userData.PFP = req.file.buffer; // Store raw buffer in database
            }

            const updatedUser = await UserService.updateUser(userID, userData);

            // Prepare response with base64-encoded PFP
            const responseUser = {
                ...updatedUser.toJSON(), // Convert Sequelize instance to plain object
            };
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString("base64"); // Convert buffer to base64 string
            }

            res.status(200).json(responseUser);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update profile failed:`, error);
            res.status(400).json({ error: error.message || "Failed to update profile due to an internal error" });
        }
    }

    static async deleteUser(req, res) {
        console.log('Received request to delete user', req.params);
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





    static async assignSupervisorsToManager(req, res) {
        console.log('Received request to assign supervisors to manager', req.body);
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

    static async revokeSupervisorsFromManager(req, res) {
        console.log('Received request to revoke supervisors from manager', req.body);
        try {
            const { managerID, supervisorIDs } = req.body;
            if (!managerID || !Array.isArray(supervisorIDs)) {
                return res.status(400).json({ error: 'Manager ID and supervisor IDs array are required' });
            }
            const result = await UserService.revokeSupervisorsFromManager(managerID, supervisorIDs);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Revoke supervisors from manager failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to revoke supervisors from manager due to an internal error' });
        }
    }

    static async getSupervisorsByUser(req, res) {
        console.log('Received request to get supervisors by user', req.params);
        try {
            const { userID } = req.params;
            if (!userID) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const supervisors = await UserService.getSupervisorsByUser(userID);
            res.status(200).json(supervisors);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get supervisors by user failed:`, error);
            res.status(404).json({ error: error.message || 'Failed to fetch supervisors' });
        }
    }

    static async getManagersByUser(req, res) {
        console.log('Received request to get managers by user', req.params);
        try {
            const { userID } = req.params;
            if (!userID) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const managers = await UserService.getManagersByUser(userID);
            res.status(200).json(managers);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get managers by user failed:`, error);
            res.status(404).json({ error: error.message || 'Failed to fetch managers' });
        }
    }
}

module.exports = UserController;