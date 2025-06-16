const UserService = require('../services/userService');
const NotificationService = require('../services/notificationService');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');
const { User, Agent } = require('../models');
/**
 * Controller for managing user operations with structured logging and notifications.
 */
class UserController {
    // --- User Retrieval Methods ---

    static async getAllUsers(req, res) {
        try {
            const cacheInstance = await cache();
            const users = await cacheInstance.getOrSet('users:all', async () => {
                return await UserService.getAllUsers();
            }, 'api');

            logRequest({
                req,
                res: users,
                status: 200,
                message: `Retrieved ${users.length} users`,
                level: 'info',
                metadata: { userCount: users.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(users);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch users: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(500).json({ error: error.message || 'Failed to fetch users' });
        }
    }

    static async getUserByPhoneNumber(req, res) {
        try {
            const { phone } = req.params;
            if (!phone) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Phone number is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Phone number is required' });
            }

            const cacheInstance = await cache();
            const user = await cacheInstance.getOrSet(`user:phone:${phone}`, async () => {
                return await UserService.getUserByPhoneNumber(phone);
            }, 'api');

            if (!user) {
                logRequest({
                    req,
                    status: 404,
                    message: 'User not found',
                    level: 'info',
                    metadata: { phone },
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(404).json({ error: 'User not found' });
            }

            logRequest({
                req,
                res: user,
                status: 200,
                message: `Retrieved user by phone ${phone}`,
                level: 'info',
                metadata: { phone },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(user);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch user by phone: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(404).json({ error: error.message || 'User not found' });
        }
    }

    static async getUsersByRole(req, res) {
        try {
            const { role } = req.params;
            if (!role) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Role is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Role is required' });
            }

            const cacheInstance = await cache();
            const users = await cacheInstance.getOrSet(`users:role:${role}`, async () => {
                return await UserService.getUsersByRole(role);
            }, 'api');

            logRequest({
                req,
                res: users,
                status: 200,
                message: `Retrieved ${users.length} users for role ${role}`,
                level: 'info',
                metadata: { role, userCount: users.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(users);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to fetch users by role: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to fetch users by role' });
        }
    }

    static async getUserById(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'User ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'User ID is required' });
            }

            const cacheInstance = await cache();
            const user = await cacheInstance.getOrSet(`user:${userID}`, async () => {
                return await UserService.getUserById(userID);
            }, 'api');

            const responseUser = user.toJSON ? user.toJSON() : { ...user };
            if (responseUser.PFP) {
                responseUser.PFP = Buffer.isBuffer(responseUser.PFP)
                    ? responseUser.PFP.toString('base64')
                    : responseUser.PFP;
            }

            logRequest({
                req,
                res: responseUser,
                status: 200,
                message: `Retrieved user ${userID}`,
                level: 'info',
                metadata: { userID },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(responseUser);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch user by ID: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(404).json({ error: error.message || 'User not found' });
        }
    }

    static async getProfile(req, res) {
        try {
            const userID = req.user?.userID;
            if (!userID) {
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to view your profile',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to view your profile' });
            }

            const cacheInstance = await cache();
            const user = await cacheInstance.getOrSet(`user:${userID}`, async () => {
                return await UserService.getUserById(userID);
            }, 'api');

            // Handle both Sequelize instance and plain object
            const responseUser = user.toJSON ? user.toJSON() : { ...user };
            if (responseUser.PFP) {
                // Ensure PFP is base64-encoded if it's a Buffer or raw binary
                responseUser.PFP = Buffer.isBuffer(responseUser.PFP)
                    ? responseUser.PFP.toString('base64')
                    : responseUser.PFP;
            }

            logRequest({
                req,
                res: responseUser,
                status: 200,
                message: `Retrieved profile for user ${userID}`,
                level: 'info',
                metadata: { userID },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(responseUser);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to fetch profile: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to fetch profile' });
        }
    }




    static async getSupervisorsByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'User ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'User ID is required' });
            }

            const cacheInstance = await cache();
            const supervisors = await cacheInstance.getOrSet(`supervisors:user:${userID}`, async () => {
                return await UserService.getSupervisorsByUser(userID);
            }, 'api');

            logRequest({
                req,
                res: supervisors,
                status: 200,
                message: `Retrieved ${supervisors.length} supervisors for user ${userID}`,
                level: 'info',
                metadata: { userID, supervisorCount: supervisors.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(supervisors);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch supervisors: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(404).json({ error: error.message || 'Supervisors not found' });
        }
    }

    static async getRegionalManagersByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'User ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'User ID is required' });
            }

            const cacheInstance = await cache();
            const regionalManagers = await cacheInstance.getOrSet(`regionalManagers:user:${userID}`, async () => {
                return await UserService.getRegionalManagersByUser(userID);
            }, 'api');

            logRequest({
                req,
                res: regionalManagers,
                status: 200,
                message: `Retrieved ${regionalManagers.length} regional managers for user ${userID}`,
                level: 'info',
                metadata: { userID, regionalManagerCount: regionalManagers.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(regionalManagers);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch regional managers: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(404).json({ error: error.message || 'Regional Managers not found' });
        }
    }

    static async getDirectorByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'User ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'User ID is required' });
            }

            const cacheInstance = await cache();
            const director = await cacheInstance.getOrSet(`director:user:${userID}`, async () => {
                return await UserService.getDirectorByUser(userID);
            }, 'api');

            logRequest({
                req,
                res: director,
                status: 200,
                message: `Retrieved director for user ${userID}`,
                level: 'info',
                metadata: { userID, directorCount: director.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(director);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch director: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(404).json({ error: error.message || 'Director not found' });
        }
    }




    static async getUsersByRegion(req, res) {
        try {
            const { regionID } = req.params;
            if (!regionID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Region ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Region ID is required' });
            }

            const cacheInstance = await cache();
            const users = await cacheInstance.getOrSet(`users:region:${regionID}`, async () => {
                return await UserService.getUsersByRegion(regionID);
            }, 'api');

            logRequest({
                req,
                res: users,
                status: 200,
                message: `Retrieved ${users.length} users for region ${regionID}`,
                level: 'info',
                metadata: { regionID, userCount: users.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(users);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch users by region: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(404).json({ error: error.message || 'Users not found' });
        }
    }

    static async getUsersByGovernorate(req, res) {
        try {
            const { governorateID } = req.params;
            if (!governorateID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Governorate ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Governorate ID is required' });
            }

            const cacheInstance = await cache();
            const users = await cacheInstance.getOrSet(`users:governorate:${governorateID}`, async () => {
                return await UserService.getUsersByGovernorate(governorateID);
            }, 'api');

            logRequest({
                req,
                res: users,
                status: 200,
                message: `Retrieved ${users.length} users for governorate ${governorateID}`,
                level: 'info',
                metadata: { governorateID, userCount: users.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(users);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch users by governorate: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(404).json({ error: error.message || 'Users not found' });
        }
    }

    static async getUsersByDelegation(req, res) {
        try {
            const { delegationID } = req.params;
            if (!delegationID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Delegation ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Delegation ID is required' });
            }

            const cacheInstance = await cache();
            const users = await cacheInstance.getOrSet(`users:delegation:${delegationID}`, async () => {
                return await UserService.getUsersByDelegation(delegationID);
            }, 'api');

            logRequest({
                req,
                res: users,
                status: 200,
                message: `Retrieved ${users.length} users for delegation ${delegationID}`,
                level: 'info',
                metadata: { delegationID, userCount: users.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(users);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch users by delegation: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(404).json({ error: error.message || 'Users not found' });
        }
    }




    static async getSupervisorsByRegionalManager(req, res) {
        try {
            const { regionalManagerID } = req.params;
            if (!regionalManagerID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Regional Manager ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Regional Manager ID is required' });
            }

            const cacheInstance = await cache();
            const supervisors = await cacheInstance.getOrSet(`supervisors:regionalManager:${regionalManagerID}`, async () => {
                return await UserService.getSupervisorsByRegionalManager(regionalManagerID);
            }, 'api');

            logRequest({
                req,
                res: supervisors,
                status: 200,
                message: `Retrieved ${supervisors.length} supervisors for regional manager ${regionalManagerID}`,
                level: 'info',
                metadata: { regionalManagerID, supervisorCount: supervisors.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(supervisors);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch supervisors: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(404).json({ error: error.message || 'Supervisors not found' });
        }
    }

    static async getRegionalManagersByDirector(req, res) {
        try {
            const { directorID } = req.params;
            if (!directorID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Director ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Director ID is required' });
            }

            const cacheInstance = await cache();
            const regionalManagers = await cacheInstance.getOrSet(`regionalManagers:director:${directorID}`, async () => {
                return await UserService.getRegionalManagersByDirector(directorID);
            }, 'api');

            logRequest({
                req,
                res: regionalManagers,
                status: 200,
                message: `Retrieved ${regionalManagers.length} regional managers for director ${directorID}`,
                level: 'info',
                metadata: { directorID, regionalManagerCount: regionalManagers.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(regionalManagers);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch regional managers: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(404).json({ error: error.message || 'Regional Managers not found' });
        }
    }

    static async getDirectorByRegionalManager(req, res) {
        try {
            const { regionalManagerID } = req.params;
            if (!regionalManagerID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Regional Manager ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Regional Manager ID is required' });
            }

            const cacheInstance = await cache();
            const director = await cacheInstance.getOrSet(`director:regionalManager:${regionalManagerID}`, async () => {
                return await UserService.getDirectorByRegionalManager(regionalManagerID);
            }, 'api');

            logRequest({
                req,
                res: director,
                status: 200,
                message: `Retrieved director for regional manager ${regionalManagerID}`,
                level: 'info',
                metadata: { regionalManagerID, directorCount: director.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(director);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: `Failed to fetch director: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(404).json({ error: error.message || 'Director not found' });
        }
    }

    static async getRegionalManagerBySupervisor(req, res) {
        try {
            const { supervisorID } = req.params;
            if (!supervisorID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Supervisor ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Supervisor ID is required' });
            }

            const cacheInstance = await cache();
            const regionalManager = await cacheInstance.getOrSet(`regionalManager:supervisor:${supervisorID}`, async () => {
                return await UserService.getRegionalManagerBySupervisor(supervisorID);
            }, 'api');

            logRequest({
                req,
                res: regionalManager,
                status: 200,
                message: `Retrieved regional manager for supervisor ${supervisorID}`,
                level: 'info',
                metadata: { supervisorID, regionalManagerCount: regionalManager.length },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            return res.status(200).json(regionalManager);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 401,
                message: `Failed to fetch regional manager: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(401).json({ error: error.message || 'Regional Manager not found' });
        }
    }

    // --- User Modification Methods ---

    static async createUser(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { email, password, firstname, lastname, phone } = req.body;
            if (!email || !password || !firstname || !lastname || !phone) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'All fields are required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'All fields are required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to create a user',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to create a user' });
            }

            const user = await UserService.createUser(email, password, firstname, lastname, phone, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${user.userID}`);
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:created',
                data: user.toJSON(),
                metadata: { createdBy: req.user.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `User ${user.firstname} ${user.lastname} created`,
                requestID,
            });

            logRequest({
                req,
                res: user,
                status: 201,
                message: `Created user ${user.userID}`,
                level: 'info',
                metadata: { userID: user.userID, requestID },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone', 'password']
            });

            await transaction.commit();
            return res.status(201).json(user);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to create user: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to create user' });
        }
    }

    static async updateUser(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { userID } = req.params;
            const userData = req.body;
            if (!userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'User ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'User ID is required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to update a user',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to update a user' });
            }

            const user = await User.findByPk(userID);
            const updatedUser = await UserService.updateUser(userID, userData, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${userID}`);
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:updated',
                data: { userID, email: updatedUser.email },
                metadata: { updatedBy: req.user.email || 'unknown' },
                dynamicRecipients: [user.userID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `Account ${user.firstname} ${user.lastname} updated`,
                requestID,
            });

            logRequest({
                req,
                res: updatedUser,
                status: 200,
                message: `Updated user ${userID}`,
                level: 'info',
                metadata: { userID, requestID },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            await transaction.commit();
            return res.status(200).json(updatedUser.toJSON());
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to update user: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to update user' });
        }
    }

    static async updateProfile(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const userID = req.user?.userID;
            if (!userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to update your profile',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to update your profile' });
            }

            const userData = req.body;
            if (req.file) {
                if (!req.file.mimetype.startsWith('image/')) {
                    await transaction.rollback();
                    logRequest({
                        req,
                        status: 400,
                        message: 'Please upload a valid image',
                        level: 'info',
                        service: 'user',
                        defaultRoute: 'users'
                    });
                    return res.status(400).json({ error: 'Please upload a valid image' });
                }
                userData.PFP = req.file.buffer;
            } else if (userData.removePFP === true) {
                userData.PFP = null;
            }

            const updatedUser = await UserService.updateUser(userID, userData, userID, { transaction });
            const responseUser = updatedUser.toJSON ? updatedUser.toJSON() : { ...updatedUser };
            if (responseUser.PFP) {
                responseUser.PFP = Buffer.isBuffer(responseUser.PFP)
                    ? responseUser.PFP.toString('base64')
                    : responseUser.PFP;
            } else {
                delete responseUser.PFP;
            }

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${userID}`);
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:profile_updated',
                data: { userID, email: updatedUser.email },
                metadata: { updatedBy: req.user.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `Profile updated for user ${userID}`,
                requestID,
            });

            logRequest({
                req,
                res: responseUser,
                status: 200,
                message: `Updated profile for user ${userID}`,
                level: 'info',
                metadata: { userID, requestID },
                service: 'user',
                defaultRoute: 'users',
                sensitiveFields: ['email', 'phone']
            });

            await transaction.commit();
            return res.status(200).json(responseUser);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to update profile: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to update profile' });
        }
    }

    static async deleteUser(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { userID } = req.params;
            if (!userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'User ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'User ID is required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to delete a user',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to delete a user' });
            }

            const user = await User.findByPk(userID);
            const result = await UserService.deleteUser(userID, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${userID}`);
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:deleted',
                data: { userID },
                metadata: { deletedBy: req.user.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `Account ${user.firstname} ${user.lastname} deleted`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Deleted user ${userID}`,
                level: 'info',
                metadata: { userID, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to delete user: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to delete user' });
        }
    }

    // --- Assignment Methods ---

    static async assignRegionalManagerToSupervisor(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { supervisorID, regionalManagerID } = req.body;
            if (!supervisorID || !regionalManagerID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Supervisor ID and Regional Manager ID are required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Supervisor ID and Regional Manager ID are required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to assign a regional manager',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to assign a regional manager' });
            }

            const result = await UserService.assignRegionalManagerToSupervisor(supervisorID, regionalManagerID, req.user.userID, { transaction });
            const manager = await User.findByPk(regionalManagerID);
            const supervisor = await User.findByPk(supervisorID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${supervisorID}`);
            await cacheInstance.invalidate(`user:${regionalManagerID}`);
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:regional_manager_assigned',
                data: { supervisorID, regionalManagerID },
                metadata: { assignedBy: req.user.email || 'unknown' },
                dynamicRecipients: [supervisorID, regionalManagerID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `Regional manager ${manager.firstname} ${manager.lastname} assigned to supervisor ${supervisor.firstname} ${supervisor.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Assigned regional manager ${regionalManagerID} to supervisor ${supervisorID}`,
                level: 'info',
                metadata: { supervisorID, regionalManagerID, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to assign regional manager: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to assign regional manager' });
        }
    }

    static async revokeRegionalManagerFromSupervisor(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { supervisorID, confirmations } = req.body;
            if (!supervisorID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Supervisor ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Supervisor ID is required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to revoke a regional manager',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to revoke a regional manager' });
            }

            const result = await UserService.revokeRegionalManagerFromSupervisor(supervisorID, confirmations, { transaction });
            const supervisor = await User.findByPk(supervisorID);
            const manager = await User.findByPk(result.regionalManagerID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${supervisorID}`);
            await cacheInstance.invalidate(`user:${result.regionalManagerID}`);
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:regional_manager_revoked',
                data: { supervisorID, regionalManagerID: result.regionalManagerID },
                metadata: { revokedBy: req.user.email || 'unknown' },
                dynamicRecipients: [supervisorID, result.regionalManagerID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `Regional manager ${manager.firstname} ${manager.lastname} revoked from supervisor ${supervisor.firstname} ${supervisor.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Revoked regional manager ${result.regionalManagerID} from supervisor ${supervisorID}`,
                level: 'info',
                metadata: { supervisorID, regionalManagerID: result.regionalManagerID, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.message.includes('Confirmation required') ? 400 : 500,
                message: `Failed to revoke regional manager: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(error.message.includes('Confirmation required') ? 400 : 500).json({ error: error.message || 'Failed to revoke regional manager' });
        }
    }

    static async assignDirectorToRegionalManager(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { regionalManagerID, directorID } = req.body;
            if (!regionalManagerID || !directorID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Regional Manager ID and Director ID are required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Regional Manager ID and Director ID are required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to assign a director',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to assign a director' });
            }

            const result = await UserService.assignDirectorToRegionalManager(regionalManagerID, directorID, req.user.userID, { transaction });
            const regionalManager = await User.findByPk(regionalManagerID);
            const director = await User.findByPk(directorID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${regionalManagerID}`);
            await cacheInstance.invalidate(`user:${directorID}`);
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:director_assigned',
                data: { regionalManagerID, directorID },
                metadata: { assignedBy: req.user.email || 'unknown' },
                dynamicRecipients: [regionalManagerID, directorID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `Director ${director.firstname} ${director.lastname} assigned to regional manager ${regionalManager.firstname} ${regionalManager.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Assigned director ${directorID} to regional manager ${regionalManagerID}`,
                level: 'info',
                metadata: { regionalManagerID, directorID, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to assign director: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to assign director' });
        }
    }

    static async revokeDirectorFromRegionalManager(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { regionalManagerID } = req.body;
            if (!regionalManagerID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Regional Manager ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Regional Manager ID is required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to revoke a director',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to revoke a director' });
            }

            const result = await UserService.revokeDirectorFromRegionalManager(regionalManagerID, { transaction });
            const regionalManager = await User.findByPk(regionalManagerID);
            const director = await User.findByPk(result.directorID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${regionalManagerID}`);
            await cacheInstance.invalidate(`user:${result.directorID}`);
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:director_revoked',
                data: { regionalManagerID, directorID: result.directorID },
                metadata: { revokedBy: req.user.email || 'unknown' },
                dynamicRecipients: [regionalManagerID, result.directorID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `Director ${director.firstname} ${director.lastname} revoked from regional manager ${regionalManager.firstname} ${regionalManager.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Revoked director ${result.directorID} from regional manager ${regionalManagerID}`,
                level: 'info',
                metadata: { regionalManagerID, directorID: result.directorID, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to revoke director: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(500).json({ error: error.message || 'Failed to revoke director' });
        }
    }

    static async assignSupervisorToAgent(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { agentID, supervisorID, delegationID } = req.body;
            if (!agentID || !supervisorID || !delegationID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Agent ID, Supervisor ID, and Delegation ID are required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Agent ID, Supervisor ID, and Delegation ID are required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to assign a supervisor',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to assign a supervisor' });
            }

            const result = await UserService.assignSupervisorToAgent(agentID, supervisorID, delegationID, req.user.userID, { transaction });
            const agent = await Agent.findByPk(agentID);
            const supervisor = await User.findByPk(supervisorID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${agentID}`);
            await cacheInstance.invalidate(`user:${supervisorID}`);
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:supervisor_assigned_to_agent',
                data: { agentID, supervisorID, delegationID },
                metadata: { assignedBy: req.user.email || 'unknown' },
                dynamicRecipients: [supervisorID, supervisor.regionalManagerID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `Supervisor ${supervisor.firstname} ${supervisor.lastname} assigned to agent ${agent.name} ${agent.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Assigned supervisor ${supervisorID} to agent ${agentID}`,
                level: 'info',
                metadata: { agentID, supervisorID, delegationID, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to assign supervisor to agent: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to assign supervisor to agent' });
        }
    }

    static async revokeSupervisorFromAgent(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { agentID } = req.body;
            if (!agentID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Agent ID is required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Agent ID is required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to revoke a supervisor',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to revoke a supervisor' });
            }

            const result = await UserService.revokeSupervisorFromAgent(agentID, { transaction });
            const agent = await Agent.findByPk(agentID);
            const supervisor = await User.findByPk(result.supervisorID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${agentID}`);
            await cacheInstance.invalidate(`user:${result.supervisorID}`);
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:supervisor_revoked_from_agent',
                data: { agentID, supervisorID: result.supervisorID, delegationID: result.delegationID },
                metadata: { revokedBy: req.user.email || 'unknown' },
                dynamicRecipients: [supervisor.userID, supervisor.regionalManagerID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `Supervisor ${supervisor.firstname} ${supervisor.lastname} revoked from agent ${agent.name} ${agent.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Revoked supervisor ${result.supervisorID} from agent ${agentID}`,
                level: 'info',
                metadata: { agentID, supervisorID: result.supervisorID, delegationID: result.delegationID, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to revoke supervisor from agent: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(500).json({ error: error.message || 'Failed to revoke supervisor from agent' });
        }
    }

    static async assignRegionsToRegionalManager(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { regionalManagerID, regionIDs } = req.body;
            if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Regional Manager ID and Region IDs are required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Regional Manager ID and Region IDs are required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to assign regions',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to assign regions' });
            }

            const results = [];
            for (const regionID of regionIDs) {
                const result = await UserService.assignRegionToUser(regionalManagerID, regionID, req.user.userID, { transaction });
                results.push(result);
            }
            const regionalManager = await User.findByPk(regionalManagerID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${regionalManagerID}`);
            for (const regionID of regionIDs) {
                await cacheInstance.invalidate(`users:region:${regionID}`);
            }
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:regions_assigned',
                data: { regionalManagerID, regionIDs },
                metadata: { assignedBy: req.user.email || 'unknown' },
                dynamicRecipients: [regionalManagerID, regionalManager.directorID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `${regionIDs.length} regions assigned to regional manager ${regionalManager.firstname} ${regionalManager.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: results,
                status: 200,
                message: `Assigned ${regionIDs.length} regions to regional manager ${regionalManagerID}`,
                level: 'info',
                metadata: { regionalManagerID, regionCount: regionIDs.length, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(results);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to assign regions: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to assign regions' });
        }
    }

    static async revokeRegionsFromRegionalManager(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { regionalManagerID, regionIDs, confirmations = {} } = req.body;
            if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Regional Manager ID and Region IDs are required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Regional Manager ID and Region IDs are required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to revoke regions',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to revoke regions' });
            }

            const result = await UserService.revokeRegionsFromRegionalManager(regionalManagerID, regionIDs, confirmations, { transaction });
            const regionalManager = await User.findByPk(regionalManagerID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${regionalManagerID}`);
            for (const regionID of regionIDs) {
                await cacheInstance.invalidate(`users:region:${regionID}`);
            }
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:regions_revoked',
                data: { regionalManagerID, regionIDs, cascadeApplied: result.cascadeApplied, affectedCounts: result.affectedCounts },
                metadata: { revokedBy: req.user.email || 'unknown' },
                dynamicRecipients: [regionalManagerID, regionalManager.directorID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `${regionIDs.length} regions revoked from regional manager ${regionalManager.firstname} ${regionalManager.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Revoked ${regionIDs.length} regions from regional manager ${regionalManagerID}`,
                level: 'info',
                metadata: { regionalManagerID, regionCount: regionIDs.length, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.message.includes('Confirmation required') ? 400 : 500,
                message: `Failed to revoke regions: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(error.message.includes('Confirmation required') ? 400 : 500).json({ error: error.message || 'Failed to revoke regions' });
        }
    }

    static async assignGovernoratesToSupervisor(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { supervisorID, governorateIDs } = req.body;
            if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Supervisor ID and Governorate IDs are required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Supervisor ID and Governorate IDs are required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to assign governorates',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to assign governorates' });
            }

            const results = [];
            for (const governorateID of governorateIDs) {
                const result = await UserService.assignGovernorateToUser(supervisorID, governorateID, req.user.userID, { transaction });
                results.push(result);
            }
            const supervisor = await User.findByPk(supervisorID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${supervisorID}`);
            for (const governorateID of governorateIDs) {
                await cacheInstance.invalidate(`users:governorate:${governorateID}`);
            }
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:governorates_assigned',
                data: { supervisorID, governorateIDs },
                metadata: { assignedBy: req.user.email || 'unknown' },
                dynamicRecipients: [supervisorID, supervisor.regionalManagerID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `${governorateIDs.length} governorates assigned to supervisor ${supervisor.firstname} ${supervisor.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: results,
                status: 200,
                message: `Assigned ${governorateIDs.length} governorates to supervisor ${supervisorID}`,
                level: 'info',
                metadata: { supervisorID, governorateCount: governorateIDs.length, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(results);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to assign governorates: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to assign governorates' });
        }
    }

    static async revokeGovernoratesFromSupervisor(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { supervisorID, governorateIDs, confirmations = {} } = req.body;
            if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Supervisor ID and Governorate IDs are required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Supervisor ID and Governorate IDs are required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to revoke governorates',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to revoke governorates' });
            }

            const result = await UserService.revokeGovernoratesFromSupervisor(supervisorID, governorateIDs, confirmations, { transaction });
            const supervisor = await User.findByPk(supervisorID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${supervisorID}`);
            for (const governorateID of governorateIDs) {
                await cacheInstance.invalidate(`users:governorate:${governorateID}`);
            }
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:governorates_revoked',
                data: { supervisorID, governorateIDs, cascadeApplied: result.cascadeApplied, affectedCounts: result.affectedCounts },
                metadata: { revokedBy: req.user.email || 'unknown' },
                dynamicRecipients: [supervisorID, supervisor.regionalManagerID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `${governorateIDs.length} governorates revoked from supervisor ${supervisor.firstname} ${supervisor.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Revoked ${governorateIDs.length} governorates from supervisor ${supervisorID}`,
                level: 'info',
                metadata: { supervisorID, governorateCount: governorateIDs.length, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.message.includes('Confirmation required') ? 400 : 500,
                message: `Failed to revoke governorates: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(error.message.includes('Confirmation required') ? 400 : 500).json({ error: error.message || 'Failed to revoke governorates' });
        }
    }

    static async assignDelegationsToSupervisor(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { supervisorID, delegationIDs } = req.body;
            if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Supervisor ID and Delegation IDs are required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Supervisor ID and Delegation IDs are required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to assign delegations',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to assign delegations' });
            }

            const results = [];
            for (const delegationID of delegationIDs) {
                const result = await UserService.assignDelegationToUser(supervisorID, delegationID, req.user.userID, { transaction });
                results.push(result);
            }
            const supervisor = await User.findByPk(supervisorID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${supervisorID}`);
            for (const delegationID of delegationIDs) {
                await cacheInstance.invalidate(`users:delegation:${delegationID}`);
            }
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:delegations_assigned',
                data: { supervisorID, delegationIDs },
                metadata: { assignedBy: req.user.email || 'unknown' },
                dynamicRecipients: [supervisorID, supervisor.regionalManagerID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `${delegationIDs.length} delegations assigned to supervisor ${supervisor.firstname} ${supervisor.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: results,
                status: 200,
                message: `Assigned ${delegationIDs.length} delegations to supervisor ${supervisorID}`,
                level: 'info',
                metadata: { supervisorID, delegationCount: delegationIDs.length, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(results);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 400,
                message: `Failed to assign delegations: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(400).json({ error: error.message || 'Failed to assign delegations' });
        }
    }

    static async revokeDelegationsFromSupervisor(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { supervisorID, delegationIDs, confirmations = {} } = req.body;
            if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Supervisor ID and Delegation IDs are required',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(400).json({ error: 'Supervisor ID and Delegation IDs are required' });
            }
            if (!req.user?.userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 401,
                    message: 'Please log in to revoke delegations',
                    level: 'info',
                    service: 'user',
                    defaultRoute: 'users'
                });
                return res.status(401).json({ error: 'Please log in to revoke delegations' });
            }

            const result = await UserService.revokeDelegationsFromSupervisor(supervisorID, delegationIDs, confirmations, { transaction });
            const supervisor = await User.findByPk(supervisorID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('users');
            await cacheInstance.invalidate(`user:${supervisorID}`);
            for (const delegationID of delegationIDs) {
                await cacheInstance.invalidate(`users:delegation:${delegationID}`);
            }
            await redis.set('users:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'users');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'user:delegations_revoked',
                data: { supervisorID, delegationIDs, cascadeApplied: result.cascadeApplied, affectedCounts: result.affectedCounts },
                metadata: { revokedBy: req.user.email || 'unknown' },
                dynamicRecipients: [supervisorID, supervisor.regionalManagerID],
                triggeredByUserID: req.user.userID,
                type: 'user',
                customMessage: `${delegationIDs.length} delegations revoked from supervisor ${supervisor.firstname} ${supervisor.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Revoked ${delegationIDs.length} delegations from supervisor ${supervisorID}`,
                level: 'info',
                metadata: { supervisorID, delegationCount: delegationIDs.length, requestID },
                service: 'user',
                defaultRoute: 'users'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.message.includes('Confirmation required') ? 400 : 500,
                message: `Failed to revoke delegations: ${error.message}`,
                level: 'error',
                service: 'user',
                defaultRoute: 'users'
            });
            return res.status(error.message.includes('Confirmation required') ? 400 : 500).json({ error: error.message || 'Failed to revoke delegations' });
        }
    }
}

module.exports = UserController;