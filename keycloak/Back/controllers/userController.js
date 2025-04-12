const UserService = require('../services/userService');

// Handles user-related API requests
class UserController {
    // Create a new user
    static async createUser(req, res) {
        console.log("Creating user: ", req.body);
        try {
            const { email, password, firstname, lastname, phone, wallet } = req.body;
            const user = await UserService.createUser(email, password, firstname, lastname, phone, wallet);
            res.status(201).json(user);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Get all users
    static async getAllUsers(req, res) {
        console.log("Getting all users", true);
        try {
            const users = await UserService.getAllUsers();
            res.status(200).json(users);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Get user by phone number
    static async getUserByPhoneNumber(req, res) {
        console.log("Getting user by phone number: ", req.params);
        try {
            const { phone } = req.params;
            const user = await UserService.getUserByPhoneNumber(phone);
            res.status(200).json(user);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    // Get users by role
    static async getUsersByRole(req, res) {
        console.log("Getting users by role: ", req.params);
        try {
            const { role } = req.params;
            const users = await UserService.getUsersByRole(role);
            res.status(200).json(users);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Get user by ID
    static async getUserById(req, res) {
        console.log("Getting user by ID: ", req.params);
        try {
            const { userID } = req.params;
            const user = await UserService.getUserById(userID);
            res.status(200).json(user);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    // Update user details
    static async updateUser(req, res) {
        console.log("Updating user: ", req.params, req.body);
        try {
            const { userID } = req.params;
            const userData = req.body;
            if (req.file) {
                if (!req.file.mimetype.startsWith('image/')) {
                    return res.status(400).json({ error: 'Please upload a valid image.' });
                }
                userData.PFP = req.file.buffer;
            }
            const updatedUser = await UserService.updateUser(userID, userData);
            res.status(200).json(updatedUser);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Get user profile
    static async getProfile(req, res) {
        console.log("Getting user profile", req);
        try {
            const userID = req.user?.userID;
            if (!userID) {
                return res.status(401).json({ error: 'Please log in to view your profile.' });
            }
            const user = await UserService.getUserById(userID);
            const responseUser = user.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            }
            res.status(200).json(responseUser);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Update user profile
    static async updateProfile(req, res) {
        console.log("Updating user profile: ", req.params, req.body, req.file);
        try {
            const userID = req.user?.userID;
            if (!userID) {
                return res.status(401).json({ error: 'Please log in to update your profile.' });
            }
            const userData = req.body;
            if (req.file) {
                if (!req.file.mimetype.startsWith('image/')) {
                    return res.status(400).json({ error: 'Please upload a valid image.' });
                }
                userData.PFP = req.file.buffer;
            }
            const updatedUser = await UserService.updateUser(userID, userData);
            const responseUser = updatedUser.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            } else {
                delete responseUser.PFP;
            }
            res.status(200).json(responseUser);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Delete a user
    static async deleteUser(req, res) {
        console.log("Deleting user: ", req.params);
        try {
            const { userID } = req.params;
            const result = await UserService.deleteUser(userID);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Assign supervisors to a manager
    static async assignSupervisorsToManager(req, res) {
        console.log("Assigning supervisors to manager: ", req.body);
        try {
            const { managerID, supervisorIDs } = req.body;
            const result = await UserService.assignSupervisorsToManager(managerID, supervisorIDs);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Revoke supervisors from a manager
    static async revokeSupervisorsFromManager(req, res) {
        console.log("Revoking supervisors from manager: ", req.body);
        try {
            const { managerID, supervisorIDs } = req.body;
            const result = await UserService.revokeSupervisorsFromManager(managerID, supervisorIDs);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Get supervisors for a user
    static async getSupervisorsByUser(req, res) {
        console.log("Getting supervisors for user: ", req.params);
        try {
            const { userID } = req.params;
            const supervisors = await UserService.getSupervisorsByUser(userID);
            res.status(200).json(supervisors);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    // Get managers for a user
    static async getManagersByUser(req, res) {
        console.log("Getting managers for user: ", req.params);
        try {
            const { userID } = req.params;
            const managers = await UserService.getManagersByUser(userID);
            res.status(200).json(managers);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }
}

module.exports = UserController;