const UserService = require('../services/userService');
const logger = require('../utils/logger');

class UserController {
    static async createUser(req, res) {
        try {
            const { email, password, firstname, lastname, phone, wallet } = req.body;
            if (!email || !password || !firstname || !lastname || !phone || !wallet) {
                logger.warn(`Create user failed: Missing fields, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'All fields are required.' });
            }
            const user = await UserService.createUser(email, password, firstname, lastname, phone, wallet, req.user.userID);
            logger.info(`User created: ${email} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(201).json(user);
        } catch (error) {
            logger.error(`Create user error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message });
        }
    }

    static async getAllUsers(req, res) {
        try {
            const users = await UserService.getAllUsers();
            logger.info(`Fetched all users by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(users);
        } catch (error) {
            logger.error(`Fetch users error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message });
        }
    }

    static async getUserByPhoneNumber(req, res) {
        try {
            const { phone } = req.params;
            if (!phone) {
                logger.warn(`Get user by phone failed: Missing phone, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Phone number is required.' });
            }
            const user = await UserService.getUserByPhoneNumber(phone);
            logger.info(`Fetched user by phone ${phone} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(user);
        } catch (error) {
            logger.error(`Get user by phone error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(404).json({ error: error.message });
        }
    }

    static async getUsersByRole(req, res) {
        try {
            const { role } = req.params;
            if (!role) {
                logger.warn(`Get users by role failed: Missing role, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Role is required.' });
            }
            const users = await UserService.getUsersByRole(role);
            logger.info(`Fetched users by role ${role} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(users);
        } catch (error) {
            logger.error(`Get users by role error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message });
        }
    }

    static async getUserById(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get user by ID failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'User ID is required.' });
            }
            const user = await UserService.getUserById(userID);
            logger.info(`Fetched user ${userID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(user);
        } catch (error) {
            logger.error(`Get user by ID error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(404).json({ error: error.message });
        }
    }

    static async updateUser(req, res) {
        try {
            const { userID } = req.params;
            const userData = req.body;
            if (!userID) {
                logger.warn(`Update user failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'User ID is required.' });
            }
            if (req.file) {
                if (!req.file.mimetype.startsWith('image/')) {
                    logger.warn(`Update user failed: Invalid image, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                    return res.status(400).json({ error: 'Please upload a valid image.' });
                }
                userData.PFP = req.file.buffer;
            }
            const updatedUser = await UserService.updateUser(userID, userData, req.user.userID);
            const responseUser = updatedUser.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            } else {
                delete responseUser.PFP;
            }
            logger.info(`Updated user ${userID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error(`Update user error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message });
        }
    }

    static async getProfile(req, res) {
        try {
            const userID = req.user?.userID;
            if (!userID) {
                logger.warn(`Get profile failed: Not authenticated, IP: ${req.ip}`, { ip: req.ip });
                return res.status(401).json({ error: 'Please log in to view your profile.' });
            }
            const user = await UserService.getUserById(userID);
            const responseUser = user.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            }
            logger.info(`Fetched profile for user ${userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error(`Get profile error: ${error.message}, user: ${req.user?.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message });
        }
    }

    static async updateProfile(req, res) {
        try {
            const userID = req.user?.userID;
            if (!userID) {
                logger.warn(`Update profile failed: Not authenticated, IP: ${req.ip}`, { ip: req.ip });
                return res.status(401).json({ error: 'Please log in to update your profile.' });
            }
            const userData = req.body;
            if (req.file) {
                if (!req.file.mimetype.startsWith('image/')) {
                    logger.warn(`Update profile failed: Invalid image, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                    return res.status(400).json({ error: 'Please upload a valid image.' });
                }
                userData.PFP = req.file.buffer;
            }
            const updatedUser = await UserService.updateUser(userID, userData, req.user.userID);
            const responseUser = updatedUser.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            } else {
                delete responseUser.PFP;
            }
            logger.info(`Updated profile for user ${userID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error(`Update profile error: ${error.message}, user: ${req.user?.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message });
        }
    }

    static async deleteUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Delete user failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'User ID is required.' });
            }
            const result = await UserService.deleteUser(userID, req.user.userID);
            logger.info(`Deleted user ${userID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Delete user error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message });
        }
    }

    static async assignSupervisorsToManager(req, res) {
        try {
            const { managerID, supervisorIDs } = req.body;
            if (!managerID || !Array.isArray(supervisorIDs) || supervisorIDs.length === 0) {
                logger.warn(`Assign supervisors failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Manager ID and supervisor IDs are required.' });
            }
            const result = await UserService.assignSupervisorsToManager(managerID, supervisorIDs, req.user.userID);
            logger.info(`Assigned supervisors to manager ${managerID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign supervisors error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message });
        }
    }

    static async revokeSupervisorsFromManager(req, res) {
        try {
            const { managerID, supervisorIDs } = req.body;
            if (!managerID || !Array.isArray(supervisorIDs) || supervisorIDs.length === 0) {
                logger.warn(`Revoke supervisors failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Manager ID and supervisor IDs are required.' });
            }
            const result = await UserService.revokeSupervisorsFromManager(managerID, supervisorIDs, req.user.userID);
            logger.info(`Revoked supervisors from manager ${managerID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke supervisors error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(400).json({ error: error.message });
        }
    }

    static async getSupervisorsByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get supervisors failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'User ID is required.' });
            }
            const supervisors = await UserService.getSupervisorsByUser(userID);
            logger.info(`Fetched supervisors for user ${userID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(supervisors);
        } catch (error) {
            logger.error(`Get supervisors error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(404).json({ error: error.message });
        }
    }

    static async getManagersByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get managers failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'User ID is required.' });
            }
            const managers = await UserService.getManagersByUser(userID);
            logger.info(`Fetched managers for user ${userID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(managers);
        } catch (error) {
            logger.error(`Get managers error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(404).json({ error: error.message });
        }
    }

    static async assignGoogleAccount(req, res) {
        try {
            const { userID } = req.params;
            const { googleEmail } = req.body;
            if (!userID || !googleEmail) {
                logger.warn(`Assign Google account failed: Missing fields, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID and Google email are required.' });
            }
            const updatedUser = await UserService.assignGoogleAccount(userID, googleEmail, req.user.userID);
            logger.info(`Assigned Google account to user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(updatedUser);
        } catch (error) {
            logger.error(`Assign Google account error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }
}

module.exports = UserController;