const UserService = require('../services/userService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing user-related operations.
 */
class UserController {
    // --- User Retrieval Methods ---

    /**
     * Get all users.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with users or error.
     */
    static async getAllUsers(req, res) {
        try {
            const users = await UserService.getAllUsers();
            logger.info(`Fetched all users by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(users);
        } catch (error) {
            logger.error(`Fetch users error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
    }

    /**
     * Get a user by phone number.
     * @param {Object} req - Express request object with phone in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with user or error.
     */
    static async getUserByPhoneNumber(req, res) {
        try {
            const { phone } = req.params;
            if (!phone) {
                logger.warn(`Get user by phone failed: Missing phone, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Phone number is required' });
            }
            const user = await UserService.getUserByPhoneNumber(phone);
            logger.info(`Fetched user by phone ${phone} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(user);
        } catch (error) {
            logger.error(`Get user by phone error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(404).json({ error: 'User not found' });
        }
    }

    /**
     * Get users by role.
     * @param {Object} req - Express request object with role in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with users or error.
     */
    static async getUsersByRole(req, res) {
        try {
            const { role } = req.params;
            if (!role) {
                logger.warn(`Get users by role failed: Missing role, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Role is required' });
            }
            const users = await UserService.getUsersByRole(role);
            logger.info(`Fetched users by role ${role} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(users);
        } catch (error) {
            logger.error(`Get users by role error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: 'Failed to fetch users by role' });
        }
    }

    /**
     * Get a user by ID.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with user or error.
     */
    static async getUserById(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get user by ID failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const user = await UserService.getUserById(userID);
            logger.info(`Fetched user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(user);
        } catch (error) {
            logger.error(`Get user by ID error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(404).json({ error: 'User not found' });
        }
    }

    /**
     * Get the current user's profile.
     * @param {Object} req - Express request object with authenticated user.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with user profile or error.
     */
    static async getProfile(req, res) {
        try {
            const userID = req.user?.userID;
            if (!userID) {
                logger.warn(`Get profile failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to view your profile' });
            }
            const user = await UserService.getUserById(userID);
            const responseUser = user.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            }
            logger.info(`Fetched profile for user ${userID}, IP: ${req.ip}`);
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error(`Get profile error: ${error.message}, user: ${req.user?.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: 'Failed to fetch profile' });
        }
    }

    /**
     * Get supervisors for a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with supervisors or error.
     */
    static async getSupervisorsByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get supervisors failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const supervisors = await UserService.getSupervisorsByUser(userID);
            logger.info(`Fetched supervisors for user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(supervisors);
        } catch (error) {
            logger.error(`Get supervisors error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(404).json({ error: 'Supervisors not found' });
        }
    }

    /**
     * Get managers for a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with managers or error.
     */
    static async getManagersByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get managers failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const managers = await UserService.getManagersByUser(userID);
            logger.info(`Fetched managers for user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(managers);
        } catch (error) {
            logger.error(`Get managers error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(404).json({ error: 'Managers not found' });
        }
    }

    // --- User Modification Methods ---

    /**
     * Create a new user.
     * @param {Object} req - Express request object with user data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created user or error.
     */
    static async createUser(req, res) {
        try {
            const { email, password, firstname, lastname, phone, wallet } = req.body;
            if (!email || !password || !firstname || !lastname || !phone || !wallet) {
                logger.warn(`Create user failed: Missing fields, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'All fields are required' });
            }
            const user = await UserService.createUser(email, password, firstname, lastname, phone, wallet, req.user.userID);
            // Notify managers and supervisors of new user
            await NotificationService.triggerNotification({
                event: 'user:created',
                data: { userID: user.userID, email },
                metadata: { createdBy: req.user.email }
            });
            logger.info(`User created: ${email} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(user);
        } catch (error) {
            logger.error(`Create user error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Update a user's details.
     * @param {Object} req - Express request object with userID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated user or error.
     */
    static async updateUser(req, res) {
        try {
            const { userID } = req.params;
            const userData = req.body;
            if (!userID) {
                logger.warn(`Update user failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            if (req.file) {
                if (!req.file.mimetype.startsWith('image/')) {
                    logger.warn(`Update user failed: Invalid image, user: ${req.user.userID}, IP: ${req.ip}`);
                    return res.status(400).json({ error: 'Please upload a valid image' });
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
            // Notify user and their manager of update
            await NotificationService.triggerNotification({
                event: 'user:updated',
                data: { userID, email: updatedUser.email },
                metadata: { updatedBy: req.user.email }
            });
            logger.info(`Updated user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error(`Update user error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Update a user's details.
     * @param {Object} req - Express request object with userID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated user or error.
     */
    static async updateUser(req, res) {
        try {
            const { userID } = req.params;
            const userData = req.body;
            if (!userID) {
                logger.warn(`Update user failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            if (req.file) {
                if (!req.file.mimetype.startsWith('image/')) {
                    logger.warn(`Update user failed: Invalid image, user: ${req.user.userID}, IP: ${req.ip}`);
                    return res.status(400).json({ error: 'Please upload a valid image' });
                }
                userData.PFP = req.file.buffer;
            } else if (userData.removePFP === true) {
                userData.PFP = null; // Explicitly set PFP to null to remove it
            }
            const updatedUser = await UserService.updateUser(userID, userData, req.user.userID);
            const responseUser = updatedUser.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            } else {
                delete responseUser.PFP;
            }
            // Notify user and their manager of update
            await NotificationService.triggerNotification({
                event: 'user:updated',
                data: { userID, email: updatedUser.email },
                metadata: { updatedBy: req.user.email }
            });
            logger.info(`Updated user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error(`Update user error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Update the current user's profile.
     * @param {Object} req - Express request object with authenticated user and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated profile or error.
     */
    static async updateProfile(req, res) {
        try {
            const userID = req.user?.userID;
            if (!userID) {
                logger.warn(`Update profile failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to update your profile' });
            }
            const userData = req.body;
            if (req.file) {
                if (!req.file.mimetype.startsWith('image/')) {
                    logger.warn(`Update profile failed: Invalid image, user: ${req.user.userID}, IP: ${req.ip}`);
                    return res.status(400).json({ error: 'Please upload a valid image' });
                }
                userData.PFP = req.file.buffer;
            } else if (userData.removePFP === true) {
                userData.PFP = null;
            }
            const updatedUser = await UserService.updateUser(userID, userData, req.user.userID);
            const responseUser = updatedUser.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            } else {
                delete responseUser.PFP;
            }
            // Notify user of profile update
            await NotificationService.triggerNotification({
                event: 'user:profile_updated',
                data: { userID, email: updatedUser.email },
                metadata: { updatedBy: req.user.email }
            });
            logger.info(`Updated profile for user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error(`Update profile error: ${error.message}, user: ${req.user?.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Delete a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async deleteUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Delete user failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const result = await UserService.deleteUser(userID, req.user.userID);
            // Notify managers and supervisors of deletion
            await NotificationService.triggerNotification({
                event: 'user:deleted',
                data: { userID },
                metadata: { deletedBy: req.user.email }
            });
            logger.info(`Deleted user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Delete user error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Assign supervisors to a manager.
     * @param {Object} req - Express request object with managerID and supervisorIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async assignSupervisorsToManager(req, res) {
        try {
            const { managerID, supervisorIDs } = req.body;
            if (!managerID || !Array.isArray(supervisorIDs) || supervisorIDs.length === 0) {
                logger.warn(`Assign supervisors failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Manager ID and supervisor IDs are required' });
            }
            const result = await UserService.assignSupervisorsToManager(managerID, supervisorIDs, req.user.userID);
            // Notify manager and supervisors of assignment
            await NotificationService.triggerNotification({
                event: 'user:supervisors_assigned',
                data: { managerID, supervisorIDs },
                metadata: { assignedBy: req.user.email }
            });
            logger.info(`Assigned supervisors to manager ${managerID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign supervisors error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Revoke supervisors from a manager.
     * @param {Object} req - Express request object with managerID and supervisorIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async revokeSupervisorsFromManager(req, res) {
        try {
            const { managerID, supervisorIDs } = req.body;
            if (!managerID || !Array.isArray(supervisorIDs) || supervisorIDs.length === 0) {
                logger.warn(`Revoke supervisors failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Manager ID and supervisor IDs are required' });
            }
            const result = await UserService.revokeSupervisorsFromManager(managerID, supervisorIDs, req.user.userID);
            // Notify manager and supervisors of revocation
            await NotificationService.triggerNotification({
                event: 'user:supervisors_revoked',
                data: { managerID, supervisorIDs },
                metadata: { revokedBy: req.user.email }
            });
            logger.info(`Revoked supervisors from manager ${managerID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke supervisors error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    /**
     * Assign a Google account to a user.
     * @param {Object} req - Express request object with userID in params and googleEmail in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated user or error.
     */
    static async assignGoogleAccount(req, res) {
        try {
            const { userID } = req.params;
            const { googleEmail } = req.body;
            if (!userID || !googleEmail) {
                logger.warn(`Assign Google account failed: Missing fields, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID and Google email are required' });
            }
            const updatedUser = await UserService.assignGoogleAccount(userID, googleEmail, req.user.userID);
            // Notify user of Google account assignment
            await NotificationService.triggerNotification({
                event: 'user:google_account_assigned',
                data: { userID, googleEmail },
                metadata: { assignedBy: req.user.email }
            });
            logger.info(`Assigned Google account to user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(updatedUser);
        } catch (error) {
            logger.error(`Assign Google account error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }
}

module.exports = UserController;