const UserService = require('../services/userService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing user operations with structured logging.
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const users = await UserService.getAllUsers();
            // Log success with structured data
            logger.info('Successfully fetched all users', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userCount: users.length },
                sensitiveFields: ['email', 'phone'] // Encrypt sensitive fields
            });
            return res.status(200).json(users);
        } catch (error) {
            // Log error with structured data
            logger.error('Failed to fetch all users', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const { phone } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!phone) {
            logger.error('Missing phone number parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Phone number is required' });
        }
        try {
            const user = await UserService.getUserByPhoneNumber(phone);
            logger.info('Successfully fetched user by phone number', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { phone: phone },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(user);
        } catch (error) {
            logger.error('Failed to fetch user by phone number', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, phone: phone }
            });
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
        const { role } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!role) {
            logger.error('Missing role parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Role is required' });
        }
        try {
            const users = await UserService.getUsersByRole(role);
            logger.info('Successfully fetched users by role', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { role: role, userCount: users.length },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(users);
        } catch (error) {
            logger.error('Failed to fetch users by role', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, role: role }
            });
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
        const { userID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!userID) {
            logger.error('Missing userID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'User ID is required' });
        }
        try {
            const user = await UserService.getUserById(userID);
            const responseUser = user.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            }
            logger.info('Successfully fetched user by ID', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: userID },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error('Failed to fetch user by ID', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, userID: userID }
            });
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
        const { email, password, firstname, lastname, phone } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!email || !password || !firstname || !lastname || !phone) {
            logger.error('Missing required fields for user creation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'All fields are required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for user creation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to create a user' });
        }
        try {
            const user = await UserService.createUser(email, password, firstname, lastname, phone, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:created',
                data: { userID: user.userID, email },
                metadata: { createdBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully created user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 201,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: user.userID },
                sensitiveFields: ['email', 'phone', 'password']
            });
            return res.status(201).json(user);
        } catch (error) {
            logger.error('Failed to create user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const { userID } = req.params;
        const userData = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!userID) {
            logger.error('Missing userID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'User ID is required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for user update', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to update a user' });
        }
        try {
            const updatedUser = await UserService.updateUser(userID, userData, req.user.userID);
            const responseUser = updatedUser.toJSON();
            await NotificationService.triggerNotification({
                event: 'user:updated',
                data: { userID, email: updatedUser.email },
                metadata: { updatedBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully updated user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: userID },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error('Failed to update user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, userID: userID }
            });
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
        const userID = req.user?.userID;
        const actorID = userID || 'unknown';
        if (!userID) {
            logger.error('User not authenticated for profile update', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to update your profile' });
        }
        const userData = req.body;
        if (req.file) {
            if (!req.file.mimetype.startsWith('image/')) {
                logger.error('Invalid image uploaded for profile', {
                    route: 'users',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { userID: userID }
                });
                return res.status(400).json({ error: 'Please upload a valid image' });
            }
            userData.PFP = req.file.buffer;
        } else if (userData.removePFP === true) {
            userData.PFP = null;
        }
        try {
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
            logger.info('Successfully updated user profile', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: userID },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error('Failed to update user profile', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, userID: userID }
            });
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
        const { userID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!userID) {
            logger.error('Missing userID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'User ID is required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for user deletion', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to delete a user' });
        }
        try {
            const result = await UserService.deleteUser(userID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:deleted',
                data: { userID },
                metadata: { deletedBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully deleted user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: userID }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to delete user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, userID: userID }
            });
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
        const userID = req.user?.userID;
        const actorID = userID || 'unknown';
        if (!userID) {
            logger.error('User not authenticated for profile retrieval', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to view your profile' });
        }
        try {
            const user = await UserService.getUserById(userID);
            const responseUser = user.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            }
            logger.info('Successfully fetched user profile', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: userID },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error('Failed to fetch user profile', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, userID: userID }
            });
            return res.status(400).json({ error: error.message || 'Failed to fetch profile' });
        }
    }

    /**
     * Get supervisors assigned to a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with supervisors or error.
     */
    static async getSupervisorsByUser(req, res) {
        const { userID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!userID) {
            logger.error('Missing userID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'User ID is required' });
        }
        try {
            const supervisors = await UserService.getSupervisorsByUser(userID);
            logger.info('Successfully fetched supervisors for user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: userID, supervisorCount: supervisors.length },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(supervisors);
        } catch (error) {
            logger.error('Failed to fetch supervisors for user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, userID: userID }
            });
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
        const { userID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!userID) {
            logger.error('Missing userID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'User ID is required' });
        }
        try {
            const regionalManagers = await UserService.getRegionalManagersByUser(userID);
            logger.info('Successfully fetched regional managers for user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: userID, regionalManagerCount: regionalManagers.length },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(regionalManagers);
        } catch (error) {
            logger.error('Failed to fetch regional managers for user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, userID: userID }
            });
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
        const { userID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!userID) {
            logger.error('Missing userID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'User ID is required' });
        }
        try {
            const director = await UserService.getDirectorByUser(userID);
            logger.info('Successfully fetched director for user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: userID, directorCount: director.length },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(director);
        } catch (error) {
            logger.error('Failed to fetch director for user', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, userID: userID }
            });
            return res.status(404).json({ error: error.message || 'Director not found' });
        }
    }

    /**
     * Get users by region.
     * @param {Object} req - Express request object with regionID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with users or error.
     */
    static async getUsersByRegion(req, res) {
        const { regionID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!regionID) {
            logger.error('Missing regionID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Region ID is required' });
        }
        try {
            const users = await UserService.getUsersByRegion(regionID);
            logger.info('Successfully fetched users by region', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { regionID: regionID, userCount: users.length },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(users);
        } catch (error) {
            logger.error('Failed to fetch users by region', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, regionID: regionID }
            });
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
        const { governorateID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!governorateID) {
            logger.error('Missing governorateID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Governorate ID is required' });
        }
        try {
            const users = await UserService.getUsersByGovernorate(governorateID);
            logger.info('Successfully fetched users by governorate', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { governorateID: governorateID, userCount: users.length },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(users);
        } catch (error) {
            logger.error('Failed to fetch users by governorate', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, governorateID: governorateID }
            });
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
        const { delegationID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!delegationID) {
            logger.error('Missing delegationID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Delegation ID is required' });
        }
        try {
            const users = await UserService.getUsersByDelegation(delegationID);
            logger.info('Successfully fetched users by delegation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { delegationID: delegationID, userCount: users.length },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(users);
        } catch (error) {
            logger.error('Failed to fetch users by delegation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, delegationID: delegationID }
            });
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
        const { regionalManagerID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!regionalManagerID) {
            logger.error('Missing regionalManagerID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Regional Manager ID is required' });
        }
        try {
            const supervisors = await UserService.getSupervisorsByRegionalManager(regionalManagerID);
            logger.info('Successfully fetched supervisors by regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { regionalManagerID: regionalManagerID, supervisorCount: supervisors.length },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(supervisors);
        } catch (error) {
            logger.error('Failed to fetch supervisors by regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, regionalManagerID: regionalManagerID }
            });
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
        const { directorID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!directorID) {
            logger.error('Missing directorID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Director ID is required' });
        }
        try {
            const regionalManagers = await UserService.getRegionalManagersByDirector(directorID);
            logger.info('Successfully fetched regional managers by director', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { directorID: directorID, regionalManagerCount: regionalManagers.length },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(regionalManagers);
        } catch (error) {
            logger.error('Failed to fetch regional managers by director', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, directorID: directorID }
            });
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
        const { regionalManagerID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!regionalManagerID) {
            logger.error('Missing regionalManagerID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Regional Manager ID is required' });
        }
        try {
            const director = await UserService.getDirectorByRegionalManager(regionalManagerID);
            logger.info('Successfully fetched director by regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { regionalManagerID: regionalManagerID, directorCount: director.length },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(director);
        } catch (error) {
            logger.error('Failed to fetch director by regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, regionalManagerID: regionalManagerID }
            });
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
        const { supervisorID } = req.params;
        const actorID = req.user?.userID || 'unknown';
        if (!supervisorID) {
            logger.error('Missing supervisorID parameter', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Supervisor ID is required' });
        }
        try {
            const regionalManager = await UserService.getRegionalManagerBySupervisor(supervisorID);
            logger.info('Successfully fetched regional manager by supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { supervisorID: supervisorID, regionalManagerCount: regionalManager.length },
                sensitiveFields: ['email', 'phone']
            });
            return res.status(200).json(regionalManager);
        } catch (error) {
            logger.error('Failed to fetch regional manager by supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, supervisorID: supervisorID }
            });
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
        const { supervisorID, regionalManagerID } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!supervisorID || !regionalManagerID) {
            logger.error('Missing required fields for regional manager assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Supervisor ID and Regional Manager ID are required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for regional manager assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to assign a regional manager' });
        }
        try {
            const result = await UserService.assignRegionalManagerToSupervisor(supervisorID, regionalManagerID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:regional_manager_assigned',
                data: { supervisorID, regionalManagerID },
                metadata: { assignedBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully assigned regional manager to supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { supervisorID: supervisorID, regionalManagerID: regionalManagerID }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to assign regional manager to supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, supervisorID: supervisorID, regionalManagerID: regionalManagerID }
            });
            return res.status(400).json({ error: error.message || 'Failed to assign regional manager' });
        }
    }

    static async revokeRegionalManagerFromSupervisor(req, res) {
        const { supervisorID, confirmations } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!supervisorID) {
            logger.error('Missing supervisorID parameter or authentication issue', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Supervisor ID is required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for regional manager revocation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to revoke a regional manager' });
        }
        try {
            const result = await UserService.revokeRegionalManagerFromSupervisor(supervisorID, confirmations);
            await NotificationService.triggerNotification({
                event: 'user:regional_manager_revoked',
                data: { supervisorID, regionalManagerID: result.regionalManagerID },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully revoked regional manager from supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { supervisorID, regionalManagerID: result.regionalManagerID }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to revoke regional manager from supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: error.message.includes('Confirmation required') ? 400 : 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, supervisorID }
            });
            return res.status(error.message.includes('Confirmation required') ? 400 : 500).json({ error: error.message || 'Failed to revoke regional manager' });
        }
    }

    /**
     * Assign a director to a regional manager.
     * @param {Object} req - Express request object with regionalManagerID and directorID in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with assignment details or error.
     */
    static async assignDirectorToRegionalManager(req, res) {
        const { regionalManagerID, directorID } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!regionalManagerID || !directorID) {
            logger.error('Missing required fields for director assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Regional Manager ID and Director ID are required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for director assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to assign a director' });
        }
        try {
            const result = await UserService.assignDirectorToRegionalManager(regionalManagerID, directorID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:director_assigned',
                data: { regionalManagerID, directorID },
                metadata: { assignedBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully assigned director to regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { regionalManagerID: regionalManagerID, directorID: directorID }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to assign director to regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, regionalManagerID: regionalManagerID, directorID: directorID }
            });
            return res.status(400).json({ error: error.message || 'Failed to assign director' });
        }
    }

    static async revokeDirectorFromRegionalManager(req, res) {
        const { regionalManagerID } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!regionalManagerID) {
            logger.error('Missing regionalManagerID parameter or authentication issue', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Regional Manager ID is required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for director revocation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to revoke a director' });
        }
        try {
            const result = await UserService.revokeDirectorFromRegionalManager(regionalManagerID);
            await NotificationService.triggerNotification({
                event: 'user:director_revoked',
                data: { regionalManagerID, directorID: result.directorID },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully revoked director from regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { regionalManagerID, directorID: result.directorID }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to revoke director from regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, regionalManagerID }
            });
            return res.status(500).json({ error: error.message || 'Failed to revoke director' });
        }
    }

    /**
     * Assign a supervisor to an agent.
     * @param {Object} req - Express request object with agentID, supervisorID, and delegationID in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with assignment details or error.
     */
    static async assignSupervisorToAgent(req, res) {
        const { agentID, supervisorID, delegationID } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!agentID || !supervisorID || !delegationID) {
            logger.error('Missing required fields for supervisor assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Agent ID, Supervisor ID, and Delegation ID are required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for supervisor assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to assign a supervisor' });
        }
        try {
            const result = await UserService.assignSupervisorToAgent(agentID, supervisorID, delegationID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:supervisor_assigned_to_agent',
                data: { agentID, supervisorID, delegationID },
                metadata: { assignedBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully assigned supervisor to agent', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { agentID: agentID, supervisorID: supervisorID, delegationID: delegationID }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to assign supervisor to agent', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, agentID: agentID, supervisorID: supervisorID, delegationID: delegationID }
            });
            return res.status(400).json({ error: error.message || 'Failed to assign supervisor to agent' });
        }
    }

    static async revokeSupervisorFromAgent(req, res) {
        const { agentID } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!agentID) {
            logger.error('Missing agentID parameter or authentication issue', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Agent ID is required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for supervisor revocation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to revoke a supervisor' });
        }
        try {
            const result = await UserService.revokeSupervisorFromAgent(agentID);
            await NotificationService.triggerNotification({
                event: 'user:supervisor_revoked_from_agent',
                data: { agentID, supervisorID: result.supervisorID, delegationID: result.delegationID },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully revoked supervisor from agent', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { agentID, supervisorID: result.supervisorID, delegationID: result.delegationID }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to revoke supervisor from agent', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, agentID }
            });
            return res.status(500).json({ error: error.message || 'Failed to revoke supervisor from agent' });
        }
    }

    /**
     * Assign multiple regions to a regional manager.
     * @param {Object} req - Express request object with regionalManagerID and regionIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with assignment details or error.
     */
    static async assignRegionsToRegionalManager(req, res) {
        const { regionalManagerID, regionIDs } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
            logger.error('Missing or invalid fields for region assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Regional Manager ID and Region IDs are required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for region assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to assign regions' });
        }
        try {
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
            logger.info('Successfully assigned regions to regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { regionalManagerID: regionalManagerID, regionCount: regionIDs.length }
            });
            return res.status(200).json(results);
        } catch (error) {
            logger.error('Failed to assign regions to regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, regionalManagerID: regionalManagerID, regionIDs: regionIDs }
            });
            return res.status(400).json({ error: error.message || 'Failed to assign regions' });
        }
    }

    static async revokeRegionsFromRegionalManager(req, res) {
        const { regionalManagerID, regionIDs, confirmations = {} } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
            logger.error('Missing or invalid fields for region revocation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Regional Manager ID and Region IDs are required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for region revocation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to revoke regions' });
        }
        try {
            const result = await UserService.revokeRegionsFromRegionalManager(regionalManagerID, regionIDs, confirmations);
            await NotificationService.triggerNotification({
                event: 'user:regions_revoked',
                data: { regionalManagerID, regionIDs, cascadeApplied: result.cascadeApplied, affectedCounts: result.affectedCounts },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully revoked regions from regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { regionalManagerID, regionCount: regionIDs.length }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to revoke regions from regional manager', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: error.message.includes('Confirmation required') ? 400 : 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, regionalManagerID, regionIDs }
            });
            return res.status(error.message.includes('Confirmation required') ? 400 : 500).json({ error: error.message || 'Failed to revoke regions' });
        }
    }

    /**
     * Assign multiple governorates to a supervisor.
     * @param {Object} req - Express request object with supervisorID and governorateIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with assignment details or error.
     */
    static async assignGovernoratesToSupervisor(req, res) {
        const { supervisorID, governorateIDs } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
            logger.error('Missing or invalid fields for governorate assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Supervisor ID and Governorate IDs are required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for governorate assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to assign governorates' });
        }
        try {
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
            logger.info('Successfully assigned governorates to supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { supervisorID: supervisorID, governorateCount: governorateIDs.length }
            });
            return res.status(200).json(results);
        } catch (error) {
            logger.error('Failed to assign governorates to supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, supervisorID: supervisorID, governorateIDs: governorateIDs }
            });
            return res.status(400).json({ error: error.message || 'Failed to assign governorates' });
        }
    }

    static async revokeGovernoratesFromSupervisor(req, res) {
        const { supervisorID, governorateIDs, confirmations = {} } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
            logger.error('Missing or invalid fields for governorate revocation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Supervisor ID and Governorate IDs are required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for governorate revocation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to revoke governorates' });
        }
        try {
            const result = await UserService.revokeGovernoratesFromSupervisor(supervisorID, governorateIDs, confirmations);
            await NotificationService.triggerNotification({
                event: 'user:governorates_revoked',
                data: { supervisorID, governorateIDs, cascadeApplied: result.cascadeApplied, affectedCounts: result.affectedCounts },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully revoked governorates from supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { supervisorID, governorateCount: governorateIDs.length }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to revoke governorates from supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: error.message.includes('Confirmation required') ? 400 : 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, supervisorID, governorateIDs }
            });
            return res.status(error.message.includes('Confirmation required') ? 400 : 500).json({ error: error.message || 'Failed to revoke governorates' });
        }
    }

    /**
     * Assign multiple delegations to a supervisor.
     * @param {Object} req - Express request object with supervisorID and delegationIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with assignment details or error.
     */
    static async assignDelegationsToSupervisor(req, res) {
        const { supervisorID, delegationIDs } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
            logger.error('Missing or invalid fields for delegation assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Supervisor ID and Delegation IDs are required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for delegation assignment', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to assign delegations' });
        }
        try {
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
            logger.info('Successfully assigned delegations to supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { supervisorID: supervisorID, delegationCount: delegationIDs.length }
            });
            return res.status(200).json(results);
        } catch (error) {
            logger.error('Failed to assign delegations to supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, supervisorID: supervisorID, delegationIDs: delegationIDs }
            });
            return res.status(400).json({ error: error.message || 'Failed to assign delegations' });
        }
    }

    static async revokeDelegationsFromSupervisor(req, res) {
        const { supervisorID, delegationIDs, confirmations = {} } = req.body;
        const actorID = req.user?.userID || 'unknown';
        if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
            logger.error('Missing or invalid fields for delegation revocation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(400).json({ error: 'Supervisor ID and Delegation IDs are required' });
        }
        if (!req.user?.userID) {
            logger.error('User not authenticated for delegation revocation', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 401,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {}
            });
            return res.status(401).json({ error: 'Please log in to revoke delegations' });
        }
        try {
            const result = await UserService.revokeDelegationsFromSupervisor(supervisorID, delegationIDs, confirmations);
            await NotificationService.triggerNotification({
                event: 'user:delegations_revoked',
                data: { supervisorID, delegationIDs, cascadeApplied: result.cascadeApplied, affectedCounts: result.affectedCounts },
                metadata: { revokedBy: req.user.email || 'unknown' }
            });
            logger.info('Successfully revoked delegations from supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { supervisorID, delegationCount: delegationIDs.length }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to revoke delegations from supervisor', {
                route: 'users',
                method: req.method,
                url: req.originalUrl,
                status: error.message.includes('Confirmation required') ? 400 : 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, supervisorID, delegationIDs }
            });
            return res.status(error.message.includes('Confirmation required') ? 400 : 500).json({ error: error.message || 'Failed to revoke delegations' });
        }
    }
}

module.exports = UserController;