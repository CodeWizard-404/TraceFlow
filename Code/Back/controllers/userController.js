const UserService = require('../services/userService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing user operations.
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
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched all users by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(users);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Fetch users error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(500).json({ error: error.message || 'Failed to fetch users' });
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
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get user by phone failed: Missing phone, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Phone number is required' });
            }
            const user = await UserService.getUserByPhoneNumber(phone);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched user by phone ${phone} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(user);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get user by phone error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'User not found' });
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
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get users by role failed: Missing role, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Role is required' });
            }
            const users = await UserService.getUsersByRole(role);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched users by role ${role} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(users);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get users by role error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to fetch users by role' });
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
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get user by ID failed: Missing userID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const user = await UserService.getUserById(userID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched user ${userID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(user);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get user by ID error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'User not found' });
        }
    }

    /**
 * Create a new user.
 * @param {Object} req - Express request object with user data in body.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} JSON response with created user or error.
 */
    static async createUser(req, res) {
        try {
            const { email, password, firstname, lastname, phone } = req.body;
            if (!email || !password || !firstname || !lastname || !phone) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Create user failed: Missing fields, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'All fields are required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Create user failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to create a user' });
            }
            const user = await UserService.createUser(email, password, firstname, lastname, phone, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:created',
                data: { userID: user.userID, email },
                metadata: { createdBy: req.user.email || 'unknown' }
            });
            logger.info(`User created: ${email} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(user);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Create user error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to create user' });
        }
    }

    /**
     * Update an existing user.
     * @param {Object} req - Express request object with userID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated user or error.
     */
    static async updateUser(req, res) {
        try {
            const { userID } = req.params;
            const userData = req.body;
            if (!userID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Update user failed: Missing userID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Update user failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to update a user' });
            }
            if (req.file) {
                if (!req.file.mimetype.startsWith('image/')) {
                    logger.warn(`Update user failed: Invalid image, user: ${req.user.userID}, IP: ${req.ip}`);
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
            await NotificationService.triggerNotification({
                event: 'user:updated',
                data: { userID, email: updatedUser.email },
                metadata: { updatedBy: req.user.email || 'unknown' }
            });
            logger.info(`Updated user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseUser);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Update user error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to update user' });
        }
    }

    /**
     * Update the authenticated user's profile.
     * @param {Object} req - Express request object with user data in body.
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
                    logger.warn(`Update profile failed: Invalid image, user: ${userID}, IP: ${req.ip}`);
                    return res.status(400).json({ error: 'Please upload a valid image' });
                }
                userData.PFP = req.file.buffer;
            } else if (userData.removePFP === true) {
                userData.PFP = null;
            }
            const updatedUser = await UserService.updateUser(userID, userData, userID);
            const responseUser = updatedUser.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            } else {
                delete responseUser.PFP;
            }
            await NotificationService.triggerNotification({
                event: 'user:profile_updated',
                data: { userID, email: updatedUser.email },
                metadata: { updatedBy: req.user.email || 'unknown' }
            });
            logger.info(`Updated profile for user ${userID} by user ${userID}, IP: ${req.ip}`);
            return res.status(200).json(responseUser);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Update profile error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to update profile' });
        }
    }

    /**
     * Delete a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with success message or error.
     */
    static async deleteUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Delete user failed: Missing userID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Delete user failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to delete a user' });
            }
            const result = await UserService.deleteUser(userID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:deleted',
                data: { userID },
                metadata: { deletedBy: req.user.email || 'unknown' }
            });
            logger.info(`Deleted user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Delete user error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to delete user' });
        }
    }

    /**
     * Get the authenticated user's profile.
     * @param {Object} req - Express request object.
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
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get profile error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to fetch profile' });
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
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Assign Google account failed: Missing fields, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID and Google email are required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Assign Google account failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to assign a Google account' });
            }
            const updatedUser = await UserService.assignGoogleAccount(userID, googleEmail, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:google_account_assigned',
                data: { userID, googleEmail },
                metadata: { assignedBy: req.user.email || 'unknown' }
            });
            logger.info(`Assigned Google account to user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(updatedUser);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Assign Google account error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to assign Google account' });
        }
    }














    /**
     * Get supervisors assigned to a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with supervisors or error.
     */
    static async getSupervisorsByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get supervisors failed: Missing userID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const supervisors = await UserService.getSupervisorsByUser(userID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched supervisors for user ${userID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(supervisors);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get supervisors error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Supervisors not found' });
        }
    }

    /**
     * Get regional managers assigned to a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with regional managers or error.
     */
    static async getRegionalManagersByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get regional managers failed: Missing userID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const regionalManagers = await UserService.getRegionalManagersByUser(userID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched regional managers for user ${userID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(regionalManagers);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get regional managers error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Regional Managers not found' });
        }
    }

    /**
     * Get director assigned to a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with director or error.
     */
    static async getDirectorByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get director failed: Missing userID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const director = await UserService.getDirectorByUser(userID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched director for user ${userID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(director);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get director error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Director not found' });
        }
    }











    /**
     * Get regions assigned to a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with regions or error.
     */
    static async getRegionsByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get regions by user failed: Missing userID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const regions = await UserService.getRegionsByUser(userID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched regions for user ${userID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(regions);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get regions by user error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Regions not found' });
        }
    }

    /**
     * Get governorates assigned to a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with governorates or error.
     */
    static async getGovernoratesByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get governorates by user failed: Missing userID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const governorates = await UserService.getGovernoratesByUser(userID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched governorates for user ${userID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(governorates);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get governorates by user error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Governorates not found' });
        }
    }

    /**
     * Get delegations assigned to a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with delegations or error.
     */
    static async getDelegationsByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get delegations by user failed: Missing userID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const delegations = await UserService.getDelegationsByUser(userID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched delegations for user ${userID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(delegations);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get delegations by user error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Delegations not found' });
        }
    }






    /**
     * Get users by region.
     * @param {Object} req - Express request object with regionID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with users or error.
     */
    static async getUsersByRegion(req, res) {
        try {
            const { regionID } = req.params;
            if (!regionID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get users by region failed: Missing regionID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Region ID is required' });
            }
            const users = await UserService.getUsersByRegion(regionID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched users for region ${regionID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(users);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get users by region error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Users not found' });
        }
    }

    /**
     * Get users by governorate.
     * @param {Object} req - Express request object with governorateID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with users or error.
     */
    static async getUsersByGovernorate(req, res) {
        try {
            const { governorateID } = req.params;
            if (!governorateID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get users by governorate failed: Missing governorateID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Governorate ID is required' });
            }
            const users = await UserService.getUsersByGovernorate(governorateID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched users for governorate ${governorateID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(users);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get users by governorate error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Users not found' });
        }
    }

    /**
     * Get users by delegation.
     * @param {Object} req - Express request object with delegationID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with users or error.
     */
    static async getUsersByDelegation(req, res) {
        try {
            const { delegationID } = req.params;
            if (!delegationID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get users by delegation failed: Missing delegationID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Delegation ID is required' });
            }
            const users = await UserService.getUsersByDelegation(delegationID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched users for delegation ${delegationID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(users);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get users by delegation error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Users not found' });
        }
    }













    /**
     * Get supervisors by regional manager.
     * @param {Object} req - Express request object with regionalManagerID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with supervisors or error.
     */
    static async getSupervisorsByRegionalManager(req, res) {
        try {
            const { regionalManagerID } = req.params;
            if (!regionalManagerID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get supervisors by regional manager failed: Missing regionalManagerID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Regional Manager ID is required' });
            }
            const supervisors = await UserService.getSupervisorsByRegionalManager(regionalManagerID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched supervisors for regional manager ${regionalManagerID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(supervisors);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get supervisors by regional manager error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Supervisors not found' });
        }
    }

    /**
     * Get regional managers by director.
     * @param {Object} req - Express request object with directorID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with regional managers or error.
     */
    static async getRegionalManagersByDirector(req, res) {
        try {
            const { directorID } = req.params;
            if (!directorID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get regional managers by director failed: Missing directorID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Director ID is required' });
            }
            const regionalManagers = await UserService.getRegionalManagersByDirector(directorID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched regional managers for director ${directorID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(regionalManagers);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get regional managers by director error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Regional Managers not found' });
        }
    }

    /**
     * Get director by regional manager.
     * @param {Object} req - Express request object with regionalManagerID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with director or error.
     */
    static async getDirectorByRegionalManager(req, res) {
        try {
            const { regionalManagerID } = req.params;
            if (!regionalManagerID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get director by regional manager failed: Missing regionalManagerID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Regional Manager ID is required' });
            }
            const director = await UserService.getDirectorByRegionalManager(regionalManagerID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched director for regional manager ${regionalManagerID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(director);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get director by regional manager error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(404).json({ error: error.message || 'Director not found' });
        }
    }

    /**
     * Get regional manager by supervisor.
     * @param {Object} req - Express request object with supervisorID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with regional manager or error.
     */
    static async getRegionalManagerBySupervisor(req, res) {
        try {
            const { supervisorID } = req.params;
            if (!supervisorID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Get regional manager by supervisor failed: Missing supervisorID, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID is required' });
            }
            const regionalManager = await UserService.getRegionalManagerBySupervisor(supervisorID);
            const actorID = req.user?.userID || 'unknown';
            logger.info(`Fetched regional manager for supervisor ${supervisorID} by user ${actorID}, IP: ${req.ip}`);
            return res.status(200).json(regionalManager);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Get regional manager by supervisor error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(401).json({ error: error.message || 'Regional Manager not found' });
        }
    }



















































    /**
     * Assign a regional manager to a supervisor.
     * @param {Object} req - Express request object with supervisorID and regionalManagerID in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with assignment details or error.
     */
    static async assignRegionalManagerToSupervisor(req, res) {
        try {
            const { supervisorID, regionalManagerID } = req.body;
            if (!supervisorID || !regionalManagerID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Assign regional manager failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID and Regional Manager ID are required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Assign regional manager failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to assign a regional manager' });
            }
            const result = await UserService.assignRegionalManagerToSupervisor(supervisorID, regionalManagerID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:regional_manager_assigned',
                data: { supervisorID, regionalManagerID },
                metadata: { assignedBy: req.user.email || 'unknown' }
            });
            logger.info(`Assigned regional manager ${regionalManagerID} to supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Assign regional manager error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to assign regional manager' });
        }
    }

    /**
     * Revoke a regional manager from a supervisor.
     * @param {Object} req - Express request object with supervisorID in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with revocation details or error.
     */
    static async revokeRegionalManagerFromSupervisor(req, res) {
        try {
            const { supervisorID, confirmations } = req.body;
            if (!supervisorID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Revoke regional manager failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID is required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Revoke regional manager failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to revoke a regional manager' });
            }
            const result = await UserService.revokeRegionalManagerFromSupervisor(supervisorID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:regional_manager_revoked',
                data: { supervisorID, regionalManagerID: result.regionalManagerID },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info(`Revoked regional manager from supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Revoke regional manager error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to revoke regional manager' });
        }
    }




    /**
     * Assign a director to a regional manager.
     * @param {Object} req - Express request object with regionalManagerID and directorID in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with assignment details or error.
     */
    static async assignDirectorToRegionalManager(req, res) {
        try {
            const { regionalManagerID, directorID } = req.body;
            if (!regionalManagerID || !directorID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Assign director failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Regional Manager ID and Director ID are required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Assign director failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to assign a director' });
            }
            const result = await UserService.assignDirectorToRegionalManager(regionalManagerID, directorID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:director_assigned',
                data: { regionalManagerID, directorID },
                metadata: { assignedBy: req.user.email || 'unknown' }
            });
            logger.info(`Assigned director ${directorID} to regional manager ${regionalManagerID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Assign director error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to assign director' });
        }
    }

    /**
     * Revoke a director from a regional manager.
     * @param {Object} req - Express request object with regionalManagerID in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with revocation details or error.
     */
    static async revokeDirectorFromRegionalManager(req, res) {
        try {
            const { regionalManagerID } = req.body;
            if (!regionalManagerID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Revoke director failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Regional Manager ID is required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Revoke director failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to revoke a director' });
            }
            const result = await UserService.revokeDirectorFromRegionalManager(regionalManagerID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:director_revoked',
                data: { regionalManagerID, directorID: result.directorID },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info(`Revoked director from regional manager ${regionalManagerID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Revoke director error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to revoke director' });
        }
    }


    /**
     * Assign a supervisor to an agent.
     * @param {Object} req - Express request object with agentID, supervisorID, and delegationID in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with assignment details or error.
     */
    static async assignSupervisorToAgent(req, res) {
        try {
            const { agentID, supervisorID, delegationID } = req.body;
            if (!agentID || !supervisorID || !delegationID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Assign supervisor to agent failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Agent ID, Supervisor ID, and Delegation ID are required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Assign supervisor to agent failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to assign a supervisor' });
            }
            const result = await UserService.assignSupervisorToAgent(agentID, supervisorID, delegationID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:supervisor_assigned_to_agent',
                data: { agentID, supervisorID, delegationID },
                metadata: { assignedBy: req.user.email || 'unknown' }
            });
            logger.info(`Assigned supervisor ${supervisorID} to agent ${agentID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Assign supervisor to agent error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to assign supervisor to agent' });
        }
    }

    /**
     * Revoke a supervisor from an agent.
     * @param {Object} req - Express request object with agentID in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with revocation details or error.
     */
    static async revokeSupervisorFromAgent(req, res) {
        try {
            const { agentID } = req.body;
            if (!agentID) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Revoke supervisor from agent failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Agent ID is required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Revoke supervisor from agent failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to revoke a supervisor' });
            }
            const result = await UserService.revokeSupervisorFromAgent(agentID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:supervisor_revoked_from_agent',
                data: { agentID, supervisorID: result.supervisorID, delegationID: result.delegationID },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info(`Revoked supervisor from agent ${agentID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Revoke supervisor from agent error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to revoke supervisor from agent' });
        }
    }










    /**
     * Assign multiple regions to a regional manager.
     * @param {Object} req - Express request object with regionalManagerID and regionIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with assignment details or error.
     */
    static async assignRegionsToRegionalManager(req, res) {
        try {
            const { regionalManagerID, regionIDs } = req.body;
            if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Assign regions failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Regional Manager ID and Region IDs are required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Assign regions failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to assign regions' });
            }
            const results = [];
            for (const regionID of regionIDs) {
                const result = await UserService.assignRegionToUser(regionalManagerID, regionID, req.user.userID);
                results.push(result);
            }
            await NotificationService.triggerNotification({
                event: 'user:regions_assigned',
                data: { regionalManagerID, regionIDs },
                metadata: { assignedBy: req.user.email || 'unknown' }
            });
            logger.info(`Assigned regions to regional manager ${regionalManagerID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(results);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Assign regions error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to assign regions' });
        }
    }

    /**
     *  Revoke multiple regions from a regional manager.
     * @param {Object} req - Express request object with regionalManagerID, regionIDs, and confirmations in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with revocation details or error.
     */
    static async revokeRegionsFromRegionalManager(req, res) {
        try {
            const { regionalManagerID, regionIDs, confirmations = {} } = req.body;
            if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Revoke regions failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Regional Manager ID and Region IDs are required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Revoke regions failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to revoke regions' });
            }
            const results = [];
            for (const regionID of regionIDs) {
                const result = await UserService.revokeRegionFromUser(regionalManagerID, regionID, req.user.userID, confirmations);
                results.push(result);
            }
            await NotificationService.triggerNotification({
                event: 'user:regions_revoked',
                data: {
                    regionalManagerID,
                    regionIDs,
                    cascadeApplied: {
                        governorates: results.some(r => r.cascadeApplied?.governorates),
                        delegations: results.some(r => r.cascadeApplied?.delegations),
                        agents: results.some(r => r.cascadeApplied?.agents)
                    },
                    affectedCounts: {
                        governorates: results.reduce((sum, r) => sum + (r.affectedCounts?.governorates || 0), 0),
                        delegations: results.reduce((sum, r) => sum + (r.affectedCounts?.delegations || 0), 0),
                        agents: results.reduce((sum, r) => sum + (r.affectedCounts?.agents || 0), 0)
                    }
                },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info(`Revoked regions from regional manager ${regionalManagerID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(results);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Revoke regions error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to revoke regions' });
        }
    }



    /**
     * Assign multiple governorates to a supervisor.
     * @param {Object} req - Express request object with supervisorID and governorateIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with assignment details or error.
     */
    static async assignGovernoratesToSupervisor(req, res) {
        try {
            const { supervisorID, governorateIDs } = req.body;
            if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Assign governorates failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID and Governorate IDs are required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Assign governorates failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to assign governorates' });
            }
            const results = [];
            for (const governorateID of governorateIDs) {
                const result = await UserService.assignGovernorateToUser(supervisorID, governorateID, req.user.userID);
                results.push(result);
            }
            await NotificationService.triggerNotification({
                event: 'user:governorates_assigned',
                data: { supervisorID, governorateIDs },
                metadata: { assignedBy: req.user.email || 'unknown' }
            });
            logger.info(`Assigned governorates to supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(results);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Assign governorates error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to assign governorates' });
        }
    }

    /**
     * Revoke multiple governorates from a supervisor.
     * @param {Object} req - Express request object with supervisorID, governorateIDs, and confirmations in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with revocation details or error.
     */
    static async revokeGovernoratesFromSupervisor(req, res) {
        try {
            const { supervisorID, governorateIDs, confirmations = {} } = req.body;
            if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Revoke governorates failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID and Governorate IDs are required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Revoke governorates failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to revoke governorates' });
            }
            const results = [];
            for (const governorateID of governorateIDs) {
                const result = await UserService.revokeGovernorateFromUser(supervisorID, governorateID, req.user.userID, confirmations);
                results.push(result);
            }
            await NotificationService.triggerNotification({
                event: 'user:governorates_revoked',
                data: {
                    supervisorID,
                    governorateIDs,
                    cascadeApplied: {
                        delegations: results.some(r => r.cascadeApplied?.delegations),
                        agents: results.some(r => r.cascadeApplied?.agents)
                    },
                    affectedCounts: {
                        delegations: results.reduce((sum, r) => sum + (r.affectedCounts?.delegations || 0), 0),
                        agents: results.reduce((sum, r) => sum + (r.affectedCounts?.agents || 0), 0)
                    }
                },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info(`Revoked governorates from supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(results);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Revoke governorates error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to revoke governorates' });
        }
    }



    /**
     * Assign multiple delegations to a supervisor.
     * @param {Object} req - Express request object with supervisorID and delegationIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with assignment details or error.
     */
    static async assignDelegationsToSupervisor(req, res) {
        try {
            const { supervisorID, delegationIDs } = req.body;
            if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Assign delegations failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID and Delegation IDs are required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Assign delegations failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to assign delegations' });
            }
            const results = [];
            for (const delegationID of delegationIDs) {
                const result = await UserService.assignDelegationToUser(supervisorID, delegationID, req.user.userID);
                results.push(result);
            }
            await NotificationService.triggerNotification({
                event: 'user:delegations_assigned',
                data: { supervisorID, delegationIDs },
                metadata: { assignedBy: req.user.email || 'unknown' }
            });
            logger.info(`Assigned delegations to supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(results);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Assign delegations error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to assign delegations' });
        }
    }

    /**
     * Revoke multiple delegations from a supervisor.
     * @param {Object} req - Express request object with supervisorID, delegationIDs, and cascadeConfirmed in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with revocation details or error.
     */
    static async revokeDelegationsFromSupervisor(req, res) {
        try {
            const { supervisorID, delegationIDs, cascadeConfirmed = false } = req.body;
            if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
                const actorID = req.user?.userID || 'unknown';
                logger.warn(`Revoke delegations failed: Invalid input, user: ${actorID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID and Delegation IDs are required' });
            }
            if (!req.user?.userID) {
                logger.warn(`Revoke delegations failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to revoke delegations' });
            }
            const results = [];
            for (const delegationID of delegationIDs) {
                const result = await UserService.revokeDelegationFromUser(supervisorID, delegationID, req.user.userID, cascadeConfirmed);
                results.push(result);
            }
            await NotificationService.triggerNotification({
                event: 'user:delegations_revoked',
                data: { supervisorID, delegationIDs, cascadeApplied: results.some(r => r.cascadeApplied), affectedAgents: results.reduce((sum, r) => sum + (r.affectedAgents || 0), 0) },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info(`Revoked delegations from supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(results);
        } catch (error) {
            const actorID = req.user?.userID || 'unknown';
            logger.error(`Revoke delegations error: ${error.message}, user: ${actorID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message || 'Failed to revoke delegations' });
        }
    }














}

module.exports = UserController;