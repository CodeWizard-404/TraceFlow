const AgentService = require('../services/agentService');
const GoogleMapsService = require('../services/googleMapsService');
const logger = require('../utils/logger');


/**
 * Controller for managing agent operations with structured logging.
 */
class AgentController {
    /**
     * Create a new agent.
     * @param {Object} req - Express request object with agent data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created agent or error.
     */
    static async createAgent(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { name, lastname, email, phone, supervisorID, delegationID, latitude, longitude, locationAddress } = req.body;
            if (!name || !lastname || !email || !phone || !supervisorID || !delegationID) {
                logger.warn('Create agent failed: Missing required fields', { /* logging details */ });
                return res.status(400).json({ error: 'All fields are required' });
            }
            const result = await AgentService.createAgent({
                name, lastname, email, phone, supervisorID, delegationID, latitude, longitude, locationAddress, actorID,
            });
            if (!result.success) {
                logger.error('Create agent failed', { /* logging details */ });
                return res.status(400).json({ error: result.message, errors: result.errors });
            }
            logger.info('Successfully created agent', { /* logging details */ });
            return res.status(201).json(result.agent);
        } catch (error) {
            logger.error('Create agent error', { /* logging details */ });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get all agents.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with agents or error.
     */
    static async getAllAgents(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const agents = await AgentService.getAllAgents();
            logger.info('Successfully fetched all agents', {
                route: 'agents',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { agentCount: agents.length }
            });
            return res.status(200).json({ agents });
        } catch (error) {
            logger.error('Failed to fetch all agents', {
                route: 'agents',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get an agent by ID.
     * @param {Object} req - Express request object with agent ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with agent or error.
     */
    static async getAgentById(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Get agent failed: Missing agent ID', {
                    route: 'agents',
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
            const agent = await AgentService.getAgentById(id);
            if (!agent) {
                logger.warn('Get agent failed: Agent not found', {
                    route: 'agents',
                    method: req.method,
                    url: req.originalUrl,
                    status: 404,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { agentID: id }
                });
                return res.status(404).json({ error: 'Agent not found' });
            }
            logger.info('Successfully fetched agent by ID', {
                route: 'agents',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { agentID: id }
            });
            return res.status(200).json(agent);
        } catch (error) {
            logger.error('Failed to fetch agent by ID', {
                route: 'agents',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Update an agent.
     * @param {Object} req - Express request object with agent ID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated agent or error.
     */
    static async updateAgent(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            const { name, lastname, email, phone, supervisorID, delegationID } = req.body;
            if (!id) {
                logger.warn('Update agent failed: Missing agent ID', {
                    route: 'agents',
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
            const result = await AgentService.updateAgent(id, {
                name,
                lastname,
                email,
                phone,
                supervisorID,
                delegationID,
                actorID,
            });
            if (!result.success) {
                logger.error('Update agent failed', {
                    route: 'agents',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { error: result.message, errors: result.errors }
                });
                return res.status(400).json({ error: result.message, errors: result.errors });
            }
            logger.info('Successfully updated agent', {
                route: 'agents',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { agentID: id }
            });
            return res.status(200).json(result.agent);
        } catch (error) {
            logger.error('Failed to update agent', {
                route: 'agents',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Delete an agent.
     * @param {Object} req - Express request object with agent ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with success message or error.
     */
    static async deleteAgent(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Delete agent failed: Missing agent ID', {
                    route: 'agents',
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
            const result = await AgentService.deleteAgent(id, actorID);
            if (!result.success) {
                logger.error('Delete agent failed', {
                    route: 'agents',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { error: result.message, errors: result.errors }
                });
                return res.status(400).json({ error: result.message, errors: result.errors });
            }
            logger.info('Successfully deleted agent', {
                route: 'agents',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { agentID: id }
            });
            return res.status(200).json({ message: 'Agent deleted successfully' });
        } catch (error) {
            logger.error('Failed to delete agent', {
                route: 'agents',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get an agent by phone number.
     * @param {Object} req - Express request object with phone in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with agent or error.
     */
    static async getAgentByPhone(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { phone } = req.params;
            if (!phone) {
                logger.warn('Get agent failed: Missing phone number', {
                    route: 'agents/phone',
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
            const agent = await AgentService.getAgentByPhone(phone);
            if (!agent) {
                logger.warn('Get agent failed: Agent not found', {
                    route: 'agents/phone',
                    method: req.method,
                    url: req.originalUrl,
                    status: 404,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { phone }
                });
                return res.status(404).json({ error: 'Agent not found' });
            }
            logger.info('Successfully fetched agent by phone', {
                route: 'agents/phone',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { phone, agentID: agent.agentID }
            });
            return res.status(200).json(agent);
        } catch (error) {
            logger.error('Failed to fetch agent by phone', {
                route: 'agents/phone',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get agents by delegation.
     * @param {Object} req - Express request object with delegationID in query.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with agents or error.
     */
    static async getAgentsByDelegation(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { delegationID } = req.query;
            if (!delegationID) {
                logger.warn('Get agents failed: Missing delegation ID', {
                    route: 'agents/delegation',
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
            const agents = await AgentService.getAgentsByDelegation(delegationID);
            logger.info('Successfully fetched agents by delegation', {
                route: 'agents/delegation',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { delegationID, agentCount: agents.length }
            });
            return res.status(200).json({ agents });
        } catch (error) {
            logger.error('Failed to fetch agents by delegation', {
                route: 'agents/delegation',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get all unique agent locations.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with locations or error.
     */
    static async getAllUniqueLocations(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const locations = await AgentService.getAllUniqueLocations();
            logger.info('Successfully fetched unique locations', {
                route: 'agents/locations',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { locationCount: locations.length }
            });
            return res.status(200).json(locations);
        } catch (error) {
            logger.error('Failed to fetch unique locations', {
                route: 'agents/locations',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get an agent's supervisor.
     * @param {Object} req - Express request object with agent ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with supervisor or error.
     */
    static async getAgentSupervisor(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Get supervisor failed: Missing agent ID', {
                    route: 'agents/supervisor',
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
            const supervisor = await AgentService.getAgentSupervisor(id);
            if (!supervisor) {
                logger.warn('Get supervisor failed: Supervisor not found', {
                    route: 'agents/supervisor',
                    method: req.method,
                    url: req.originalUrl,
                    status: 404,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { agentID: id }
                });
                return res.status(404).json({ error: 'Supervisor not found' });
            }
            logger.info('Successfully fetched agent supervisor', {
                route: 'agents/supervisor',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { agentID: id, supervisorID: supervisor.userID }
            });
            return res.status(200).json(supervisor);
        } catch (error) {
            logger.error('Failed to fetch agent supervisor', {
                route: 'agents/supervisor',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get all the agents of a supervisor.
     * @param {Object} req - Express request object with supervisor ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with agents or error.
     */
    static async getAgentsBySupervisor(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Get agents failed: Missing supervisor ID', {
                    route: 'agents/supervisor-agents',
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
            const agents = await AgentService.getAgentsBySupervisor(id);
            logger.info('Successfully fetched agents by supervisor', {
                route: 'agents/supervisor-agents',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { supervisorID: id, agentCount: agents.length }
            });
            return res.status(200).json({ agents });
        } catch (error) {
            logger.error('Failed to fetch agents by supervisor', {
                route: 'agents/supervisor-agents',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get agents by user.
     * @param {Object} req - Express request object with user ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with agents or error.
     */
    static async getAgentsByUser(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Get agents failed: Missing user ID', {
                    route: 'agents/user-agents',
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
            const agents = await AgentService.getAgentsByUser(id);
            logger.info('Successfully fetched agents by user', {
                route: 'agents/user-agents',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: id, agentCount: agents.length }
            });
            return res.status(200).json({ agents });
        } catch (error) {
            logger.error('Failed to fetch agents by user', {
                route: 'agents/user-agents',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get supervisor by agent.
     * @param {Object} req - Express request object with agent ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with supervisor or error.
     */
    static async getUserByAgent(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Get user failed: Missing agent ID', {
                    route: 'agents/user-by-agent',
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
            const supervisor = await AgentService.getUserByAgent(id);
            if (!supervisor) {
                logger.warn('Get user failed: Supervisor not found', {
                    route: 'agents/user-by-agent',
                    method: req.method,
                    url: req.originalUrl,
                    status: 404,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { agentID: id }
                });
                return res.status(404).json({ error: 'Supervisor not found' });
            }
            logger.info('Successfully fetched user by agent', {
                route: 'agents/user-by-agent',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { agentID: id, supervisorID: supervisor.userID }
            });
            return res.status(200).json(supervisor);
        } catch (error) {
            logger.error('Failed to fetch user by agent', {
                route: 'agents/user-by-agent',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
       * Upload and process agents via CSV file.
       * @param {Object} req - Express request object with CSV file in body.
       * @param {Object} res - Express response object.
       * @returns {Promise<void>} JSON response with processing results or error.
       */
    static async uploadAgents(req, res) {
        const actorID = req.user?.userID || "unknown";
        try {
            if (!req.file) {
                logger.warn("Upload agents failed: No CSV file uploaded", {
                    route: "agents/upload",
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                });
                return res.status(400).json({ error: "No CSV file uploaded" });
            }

            const results = await AgentService.processAgentCSV(req.file.buffer, actorID);
            if (results.detailedLog.errors.length > 0 && results.summary.totalRecords === 0) {
                logger.warn("Upload agents failed due to validation errors", {
                    route: "agents/upload",
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { requestBody: req, errors: results.detailedLog.errors.map((e) => e.reason) },
                });
                return res.status(400).json({
                    error: "CSV processing failed",
                    details: results.detailedLog.errors,
                });
            }

            logger.info("Successfully processed agent CSV", {
                route: "agents/upload",
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: {
                    totalRecords: results.summary.totalRecords,
                    agentsCreated: results.summary.agentsCreated,
                    agentsUpdated: results.summary.agentsUpdated,
                    recordsSkipped: results.summary.recordsSkipped,
                    errorsEncountered: results.summary.errorsEncountered,
                },
            });
            return res.status(200).json(results);
        } catch (error) {
            logger.error("Failed to process agent CSV", {
                route: "agents/upload",
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { req, error: error.message },
            });
            return res.status(500).json({ error: "Internal server error" });
        }
    }













    static async getAgentLocations(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const result = await GoogleMapsService.getAgentLocations();
            logger.info('Successfully fetched agent locations', {
                route: 'agents/map/locations',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { agentsCount: result.length }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to fetch agent locations', {
                route: 'agents/map/locations',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getNearbyAgents(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { lat, lng, radius } = req.query;
            if (!lat || !lng) {
                logger.warn('Failed to fetch nearby agents: Missing coordinates', {
                    route: 'agents/nearby',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Latitude and longitude are required' });
            }
            const userLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
            const nearbyAgents = await GoogleMapsService.getNearbyAgents(userLocation, parseFloat(radius) || 5000);
            logger.info('Successfully fetched nearby agents', {
                route: 'agents/nearby',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userLocation, radius }
            });
            return res.status(200).json(nearbyAgents);
        } catch (error) {
            logger.error('Failed to fetch nearby agents', {
                route: 'agents/nearby',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAgentsByBounds(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { southWestLat, southWestLng, northEastLat, northEastLng } = req.query;
            if (!southWestLat || !southWestLng || !northEastLat || !northEastLng) {
                logger.warn('Failed to fetch agents by bounds: Missing bounds', {
                    route: 'agents/bounds',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { error: 'All bounds coordinates are required' }
                });
                return res.status(400).json({ error: 'All bounds coordinates are required' });
            }
            const agents = await AgentService.getAgentsByBounds({
                southWestLat: parseFloat(southWestLat),
                southWestLng: parseFloat(southWestLng),
                northEastLat: parseFloat(northEastLat),
                northEastLng: parseFloat(northEastLng),
            });
            logger.info('Successfully fetched agents by bounds', {
                route: 'agents/bounds',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { southWestLat, southWestLng, northEastLat, northEastLng }
            });
            return res.status(200).json(agents);
        } catch (error) {
            logger.error('Failed to fetch agents by bounds', {
                route: 'agents/bounds',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // In back/controllers/agentController.js
    static async correctAgentLocation(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { agentId, latitude, longitude, address } = req.body;
            if (!agentId || !latitude || !longitude || !address) {
                logger.warn('Correct agent location failed: Missing required fields', {
                    route: 'agents/correct-location',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                });
                return res.status(400).json({ error: 'Agent ID, latitude, longitude, and address are required' });
            }

            const result = await GoogleMapsService.updateAgentLocation(agentId, latitude, longitude, address);

            logger.info('Successfully corrected agent location', {
                route: 'agents/correct-location',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { agentId, latitude, longitude, address },
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to correct agent location', {
                route: 'agents/correct-location',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message },
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = AgentController;