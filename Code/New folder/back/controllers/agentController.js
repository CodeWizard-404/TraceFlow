const AgentService = require('../services/agentService');
const logger = require('../utils/logger');
const csv = require('csv-parse');
const { Readable } = require('stream');

/**
 * Controller for managing agent operations.
 */
class AgentController {
    /**
     * Create a new agent.
     * @param {Object} req - Express request object with agent data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created agent or error.
     */
    static async createAgent(req, res) {
        try {
            const { name, lastname, email, phone, supervisorID, delegationID } = req.body;
            if (!name || !lastname || !email || !phone || !supervisorID || !delegationID) {
                logger.warn(`Create agent failed: Missing fields, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'All fields are required' });
            }
            const result = await AgentService.createAgent({
                name,
                lastname,
                email,
                phone,
                supervisorID,
                delegationID,
                actorID: req.user.userID,
            });
            if (!result.success) {
                return res.status(400).json({ error: result.message, errors: result.errors });
            }
            logger.info(`Created agent ${result.agent.agentID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(result.agent);
        } catch (error) {
            logger.error(`Create agent error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get all agents.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with agents.
     */
    static async getAllAgents(req, res) {
        try {
            const agents = await AgentService.getAllAgents();
            logger.info(`Fetched all agents by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ agents });
        } catch (error) {
            logger.error(`Get all agents error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Get agent by ID failed: Missing ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(200).json(null);
            }
            const agent = await AgentService.getAgentById(id);
            logger.info(`Fetched agent ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(agent);
        } catch (error) {
            logger.error(`Get agent by ID error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { id } = req.params;
            const { name, lastname, email, phone, supervisorID, delegationID } = req.body;
            if (!id) {
                logger.warn(`Update agent failed: Missing ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Agent ID is required' });
            }
            const result = await AgentService.updateAgent(id, {
                name,
                lastname,
                email,
                phone,
                supervisorID,
                delegationID,
                actorID: req.user.userID,
            });
            if (!result.success) {
                return res.status(400).json({ error: result.message, errors: result.errors });
            }
            logger.info(`Updated agent ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result.agent);
        } catch (error) {
            logger.error(`Update agent error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Delete agent failed: Missing ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Agent ID is required' });
            }
            const result = await AgentService.deleteAgent(id, req.user.userID);
            if (!result.success) {
                return res.status(400).json({ error: result.message, errors: result.errors });
            }
            logger.info(`Deleted agent ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ message: 'Agent deleted successfully' });
        } catch (error) {
            logger.error(`Delete agent error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { phone } = req.params;
            if (!phone) {
                logger.warn(`Get agent by phone failed: Missing phone, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(200).json(null);
            }
            const agent = await AgentService.getAgentByPhone(phone);
            logger.info(`Fetched agent by phone ${phone} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(agent);
        } catch (error) {
            logger.error(`Get agent by phone error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { delegationID } = req.query;
            if (!delegationID) {
                logger.warn(`Get agents by delegation failed: Missing delegation, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(200).json({ agents: [] });
            }
            const agents = await AgentService.getAgentsByDelegation(delegationID);
            logger.info(`Fetched agents by delegation ${delegationID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ agents });
        } catch (error) {
            logger.error(`Get agents by delegation error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const locations = await AgentService.getAllUniqueLocations();
            logger.info(`Fetched unique locations by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(locations);
        } catch (error) {
            logger.error(`Get unique locations error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Get agent supervisor failed: Missing agent ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(200).json(null);
            }
            const supervisor = await AgentService.getAgentSupervisor(id);
            logger.info(`Fetched supervisor for agent ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(supervisor);
        } catch (error) {
            logger.error(`Get agent supervisor error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Get agents by supervisor failed: Missing supervisor ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(200).json({ agents: [] });
            }
            const agents = await AgentService.getAgentsBySupervisor(id);
            logger.info(`Fetched agents for supervisor ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ agents });
        } catch (error) {
            logger.error(`Get agents by supervisor error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get agents by supervisor.
     * @param {Object} req - Express request object with user ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with agents or error.
     */
    static async getAgentsByUser(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Get agents by user failed: Missing user ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(200).json({ agents: [] });
            }
            const agents = await AgentService.getAgentsByUser(id);
            logger.info(`Fetched agents for user ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ agents });
        } catch (error) {
            logger.error(`Get agents by user error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Get user by agent failed: Missing agent ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(200).json(null);
            }
            const supervisor = await AgentService.getUserByAgent(id);
            logger.info(`Fetched supervisor for agent ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(supervisor);
        } catch (error) {
            logger.error(`Get user by agent error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
         * Upload and process agents via CSV file.
         * @param {Object} req - Express request object with CSV file in body.
         * @param {Object} res - Express response object.
         * @returns {Promise<void>} JSON response with processing results.
         */
    static async uploadAgents(req, res) {
        try {
            if (!req.file) {
                logger.warn(`Upload agents failed: No file uploaded, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'No CSV file uploaded' });
            }

            // Log raw buffer for debugging
            const bufferPreview = req.file.buffer.toString('utf8').slice(0, 200);
            logger.info(`Received CSV buffer (first 200 chars): ${bufferPreview}`);

            const results = await AgentService.processAgentCSV(req.file.buffer, req.user.userID);
            logger.info(`Processed agent CSV by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(results);
        } catch (error) {
            logger.error(`Upload agents error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = AgentController;