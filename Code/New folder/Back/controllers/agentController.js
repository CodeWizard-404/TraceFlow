const AgentService = require('../services/agentService');
const GoogleMapsService = require('../services/googleMapsService');
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
 * Controller for managing agent operations with structured logging.
 */
class AgentController {
    static async createAgent(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { name, lastname, email, phone, supervisorID, delegationID, latitude, longitude, locationAddress } = req.body;
            const actorID = req.user?.userID || 'unknown';
            if (!name || !lastname || !email || !phone || !supervisorID || !delegationID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'All fields are required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'All fields are required' });
            }

            const result = await AgentService.createAgent({
                name, lastname, email, phone, supervisorID, delegationID, latitude, longitude, locationAddress, actorID
            }, { transaction });

            if (!result.success) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: result.message,
                    level: 'error',
                    metadata: { errors: result.errors },
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: result.message, errors: result.errors });
            }

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('agents');
            await redis.set('agents:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'agents');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'agent:created',
                data: { agentID: result.agent.agentID, name, email },
                metadata: { createdBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'agent',
                customMessage: `Agent ${name} ${lastname} created `,
                requestID,
            });

            logRequest({
                req,
                res: result.agent,
                status: 201,
                message: `Created agent ${result.agent.agentID}`,
                level: 'info',
                metadata: { agentID: result.agent.agentID, email, requestID },
                service: 'agent',
                defaultRoute: 'agents'
            });

            await transaction.commit();
            return res.status(201).json(result.agent);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to create agent: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAllAgents(req, res) {
        try {
            const cacheInstance = await cache();
            const agents = await cacheInstance.getOrSet('agents:all', async () => {
                return await AgentService.getAllAgents();
            }, 'api');

            logRequest({
                req,
                res: { agents },
                status: 200,
                message: `Retrieved ${agents.length} agents`,
                level: 'info',
                metadata: { agentCount: agents.length },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json({ agents });
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch all agents: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAgentById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Agent ID is required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'Agent ID is required' });
            }

            const cacheInstance = await cache();
            const agent = await cacheInstance.getOrSet(`agent:${id}`, async () => {
                return await AgentService.getAgentById(id);
            }, 'api');

            if (!agent) {
                logRequest({
                    req,
                    status: 404,
                    message: `Agent ${id} not found`,
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(404).json({ error: 'Agent not found' });
            }

            logRequest({
                req,
                res: agent,
                status: 200,
                message: `Retrieved agent ${id}`,
                level: 'info',
                metadata: { agentID: id },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json(agent);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch agent by ID: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async updateAgent(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { id } = req.params;
            const { name, lastname, email, phone, supervisorID, delegationID } = req.body;
            const actorID = req.user?.userID || 'unknown';
            if (!id) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Agent ID is required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'Agent ID is required' });
            }

            const result = await AgentService.updateAgent(id, {
                name, lastname, email, phone, supervisorID, delegationID, actorID
            }, { transaction });


            if (!result.success) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: result.message,
                    level: 'error',
                    metadata: { errors: result.errors },
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: result.message, errors: result.errors });
            }

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('agents');
            await cacheInstance.invalidate(`agent:${id}`);
            await redis.set('agents:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'agents');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'agent:updated',
                data: { agentID: id, name, email },
                metadata: { updatedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'agent',
                customMessage: `Agent ${result.agent.name} ${result.agent.lastname} updated `,
                requestID,
            });

            logRequest({
                req,
                res: result.agent,
                status: 200,
                message: `Updated agent ${id}`,
                level: 'info',
                metadata: { agentID: id, requestID },
                service: 'agent',
                defaultRoute: 'agents'
            });

            await transaction.commit();
            return res.status(200).json(result.agent);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to update agent: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async deleteAgent(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { id } = req.params;
            const actorID = req.user?.userID || 'unknown';
            if (!id) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Agent ID is required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'Agent ID is required' });
            }

            const agent = await Agent.findByPk(id);
            const result = await AgentService.deleteAgent(id, actorID, { transaction });

            if (!result.success) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: result.message,
                    level: 'error',
                    metadata: { errors: result.errors },
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: result.message, errors: result.errors });
            }

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('agents');
            await cacheInstance.invalidate(`agent:${id}`);
            await redis.set('agents:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'agents');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'agent:deleted',
                data: { agentID: id },
                metadata: { deletedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'agent',
                customMessage: `Agent ${agent.name} ${agent.lastname} deleted`,
                requestID,
            });

            logRequest({
                req,
                res: { message: 'Agent deleted successfully' },
                status: 200,
                message: `Deleted agent ${id}`,
                level: 'info',
                metadata: { agentID: id, requestID },
                service: 'agent',
                defaultRoute: 'agents'
            });

            await transaction.commit();
            return res.status(200).json({ message: 'Agent deleted successfully' });
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to delete agent: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAgentByPhone(req, res) {
        try {
            const { phone } = req.params;
            if (!phone) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Phone number is required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'Phone number is required' });
            }

            const cacheInstance = await cache();
            const agent = await cacheInstance.getOrSet(`agent:phone:${phone}`, async () => {
                return await AgentService.getAgentByPhone(phone);
            }, 'api');

            if (!agent) {
                logRequest({
                    req,
                    status: 404,
                    message: `Agent with phone ${phone} not found`,
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(404).json({ error: 'Agent not found' });
            }

            logRequest({
                req,
                res: agent,
                status: 200,
                message: `Retrieved agent by phone ${phone}`,
                level: 'info',
                metadata: { phone, agentID: agent.agentID },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json(agent);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch agent by phone: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAgentsByDelegation(req, res) {
        try {
            const { delegationID } = req.query;
            if (!delegationID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Delegation ID is required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'Delegation ID is required' });
            }

            const cacheInstance = await cache();
            const agents = await cacheInstance.getOrSet(`agents:delegation:${delegationID}`, async () => {
                return await AgentService.getAgentsByDelegation(delegationID);
            }, 'api');

            logRequest({
                req,
                res: { agents },
                status: 200,
                message: `Retrieved ${agents.length} agents for delegation ${delegationID}`,
                level: 'info',
                metadata: { delegationID, agentCount: agents.length },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json({ agents });
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch agents by delegation: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAllUniqueLocations(req, res) {
        try {
            const cacheInstance = await cache();
            const locations = await cacheInstance.getOrSet('agents:locations', async () => {
                return await AgentService.getAllUniqueLocations();
            }, 'api');

            logRequest({
                req,
                res: locations,
                status: 200,
                message: `Retrieved ${locations.length} unique agent locations`,
                level: 'info',
                metadata: { locationCount: locations.length },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json(locations);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch unique locations: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAgentSupervisor(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Agent ID is required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'Agent ID is required' });
            }

            const cacheInstance = await cache();
            const supervisor = await cacheInstance.getOrSet(`agent:supervisor:${id}`, async () => {
                return await AgentService.getAgentSupervisor(id);
            }, 'api');

            if (!supervisor) {
                logRequest({
                    req,
                    status: 404,
                    message: `Supervisor for agent ${id} not found`,
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(404).json({ error: 'Supervisor not found' });
            }

            logRequest({
                req,
                res: supervisor,
                status: 200,
                message: `Retrieved supervisor for agent ${id}`,
                level: 'info',
                metadata: { agentID: id, supervisorID: supervisor.userID },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json(supervisor);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch agent supervisor: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAgentsBySupervisor(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Supervisor ID is required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'Supervisor ID is required' });
            }

            const cacheInstance = await cache();
            const agents = await cacheInstance.getOrSet(`agents:supervisor:${id}`, async () => {
                return await AgentService.getAgentsBySupervisor(id);
            }, 'api');

            logRequest({
                req,
                res: { agents },
                status: 200,
                message: `Retrieved ${agents.length} agents for supervisor ${id}`,
                level: 'info',
                metadata: { supervisorID: id, agentCount: agents.length },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json({ agents });
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch agents by supervisor: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAgentsByUser(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logRequest({
                    req,
                    status: 400,
                    message: 'User ID is required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'User ID is required' });
            }

            const cacheInstance = await cache();
            const agents = await cacheInstance.getOrSet(`agents:user:${id}`, async () => {
                return await AgentService.getAgentsByUser(id);
            }, 'api');

            logRequest({
                req,
                res: { agents },
                status: 200,
                message: `Retrieved ${agents.length} agents for user ${id}`,
                level: 'info',
                metadata: { userID: id, agentCount: agents.length },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json({ agents });
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch agents by user: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getUserByAgent(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Agent ID is required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'Agent ID is required' });
            }

            const cacheInstance = await cache();
            const supervisor = await cacheInstance.getOrSet(`agent:user:${id}`, async () => {
                return await AgentService.getUserByAgent(id);
            }, 'api');

            if (!supervisor) {
                logRequest({
                    req,
                    status: 404,
                    message: `Supervisor for agent ${id} not found`,
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(404).json({ error: 'Supervisor not found' });
            }

            logRequest({
                req,
                res: supervisor,
                status: 200,
                message: `Retrieved user for agent ${id}`,
                level: 'info',
                metadata: { agentID: id, supervisorID: supervisor.userID },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json(supervisor);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch user by agent: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async uploadAgents(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const actorID = req.user?.userID || 'unknown';
            if (!req.file) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'No CSV file uploaded',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'No CSV file uploaded' });
            }

            const results = await AgentService.processAgentCSV(req.file.buffer, actorID, { transaction });

            if (results.detailedLog.errors.length > 0 && results.summary.totalRecords === 0) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'CSV processing failed due to validation errors',
                    level: 'info',
                    metadata: { errors: results.detailedLog.errors.map((e) => e.reason) },
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({
                    error: 'CSV processing failed',
                    details: results.detailedLog.errors,
                });
            }

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('agents');
            await redis.set('agents:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'agents');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'agent:csv_uploaded',
                data: {
                    totalRecords: results.summary.totalRecords,
                    agentsCreated: results.summary.agentsCreated,
                    agentsUpdated: results.summary.agentsUpdated,
                },
                metadata: { uploadedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'agent',
                customMessage: `CSV with ${results.summary.totalRecords} agent records uploaded`,
                requestID,
            });

            logRequest({
                req,
                res: results,
                status: 200,
                message: `Processed agent CSV with ${results.summary.totalRecords} records`,
                level: 'info',
                metadata: {
                    totalRecords: results.summary.totalRecords,
                    agentsCreated: results.summary.agentsCreated,
                    agentsUpdated: results.summary.agentsUpdated,
                    recordsSkipped: results.summary.recordsSkipped,
                    errorsEncountered: results.summary.errorsEncountered,
                    requestID,
                },
                service: 'agent',
                defaultRoute: 'agents'
            });

            await transaction.commit();
            return res.status(200).json(results);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to process agent CSV: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAgentLocations(req, res) {
        try {
            const cacheInstance = await cache();
            const result = await cacheInstance.getOrSet('agents:map:locations', async () => {
                return await GoogleMapsService.getAgentLocations();
            }, 'api');

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Retrieved ${result.length} agent locations`,
                level: 'info',
                metadata: { agentsCount: result.length },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch agent locations: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getNearbyAgents(req, res) {
        try {
            const { lat, lng, radius } = req.query;
            if (!lat || !lng) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Latitude and longitude are required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'Latitude and longitude are required' });
            }

            const userLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
            const cacheInstance = await cache();
            const nearbyAgents = await cacheInstance.getOrSet(`agents:nearby:${lat}:${lng}:${radius || 5000}`, async () => {
                return await GoogleMapsService.getNearbyAgents(userLocation, parseFloat(radius) || 5000);
            }, 'api');

            logRequest({
                req,
                res: nearbyAgents,
                status: 200,
                message: `Retrieved nearby agents for location ${lat},${lng}`,
                level: 'info',
                metadata: { userLocation, radius: parseFloat(radius) || 5000 },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json(nearbyAgents);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch nearby agents: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAgentsByBounds(req, res) {
        try {
            const { southWestLat, southWestLng, northEastLat, northEastLng } = req.query;
            if (!southWestLat || !southWestLng || !northEastLat || !northEastLng) {
                logRequest({
                    req,
                    status: 400,
                    message: 'All bounds coordinates are required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'All bounds coordinates are required' });
            }

            const bounds = {
                southWestLat: parseFloat(southWestLat),
                southWestLng: parseFloat(southWestLng),
                northEastLat: parseFloat(northEastLat),
                northEastLng: parseFloat(northEastLng),
            };

            const cacheInstance = await cache();
            const agents = await cacheInstance.getOrSet(`agents:bounds:${southWestLat}:${southWestLng}:${northEastLat}:${northEastLng}`, async () => {
                return await AgentService.getAgentsByBounds(bounds);
            }, 'api');

            logRequest({
                req,
                res: agents,
                status: 200,
                message: `Retrieved agents within bounds`,
                level: 'info',
                metadata: { southWestLat, southWestLng, northEastLat, northEastLng },
                service: 'agent',
                defaultRoute: 'agents'
            });

            return res.status(200).json(agents);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch agents by bounds: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async correctAgentLocation(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { agentId, latitude, longitude, address } = req.body;
            const actorID = req.user?.userID || 'unknown';
            if (!agentId || !latitude || !longitude || !address) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Agent ID, latitude, longitude, and address are required',
                    level: 'info',
                    service: 'agent',
                    defaultRoute: 'agents'
                });
                return res.status(400).json({ error: 'Agent ID, latitude, longitude, and address are required' });
            }

            const result = await GoogleMapsService.updateAgentLocation(agentId, latitude, longitude, address, { transaction });
            const agent = await Agent.findByPk(agentId);
            const user = await User.findByPk(actorID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('agents');
            await cacheInstance.invalidate(`agent:${agentId}`);
            await redis.set('agents:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'agents');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'agent:location_corrected',
                data: { agentId, latitude, longitude, address },
                metadata: { updatedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'agent',
                customMessage: `Agent ${agent.name} ${agent.lastname} location corrected by ${user.firstname} ${user.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Corrected location for agent ${agentId}`,
                level: 'info',
                metadata: { agentId, latitude, longitude, address, requestID },
                service: 'agent',
                defaultRoute: 'agents'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to correct agent location: ${error.message}`,
                level: 'error',
                service: 'agent',
                defaultRoute: 'agents'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = AgentController;