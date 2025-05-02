const AgentService = require('../services/agentService');
const logger = require('../utils/logger');
const { Region, Governorate, Delegation, User } = require('../models');

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
            const agent = await AgentService.createAgent({
                name,
                lastname,
                email,
                phone,
                supervisorID,
                delegationID,
                actorID: req.user.userID,
            });
            logger.info(`Created agent ${agent.agentID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(agent);
        } catch (error) {
            logger.error(`Create agent error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}-------------------------------------------------------------------------------------------`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to create agent' });
        }
    }

    /**
     * Get all agents.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with agents or error.
     */
    static async getAllAgents(req, res) {
        try {
            const agents = await AgentService.getAllAgents();
            logger.info(`Fetched all agents by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ agents }); // Wrap in object to match expected response
        } catch (error) {
            logger.error(`Get all agents error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: error.message || 'Failed to retrieve agents' });
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
                return res.status(400).json({ error: 'Agent ID is required' });
            }
            const agent = await AgentService.getAgentById(id);
            logger.info(`Fetched agent ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(agent);
        } catch (error) {
            logger.error(`Get agent by ID error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Agent not found' });
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
            const agent = await AgentService.updateAgent(id, {
                name,
                lastname,
                email,
                phone,
                supervisorID,
                delegationID,
                actorID: req.user.userID,
            });
            logger.info(`Updated agent ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(agent);
        } catch (error) {
            logger.error(`Update agent error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to update agent' });
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
            await AgentService.deleteAgent(id, req.user.userID);
            logger.info(`Deleted agent ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ message: 'Agent deleted successfully' });
        } catch (error) {
            logger.error(`Delete agent error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to delete agent' });
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
                return res.status(400).json({ error: 'Phone number is required' });
            }
            const agent = await AgentService.getAgentByPhone(phone);
            logger.info(`Fetched agent by phone ${phone} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(agent);
        } catch (error) {
            logger.error(`Get agent by phone error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Agent not found' });
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
                return res.status(400).json({ error: 'Delegation ID is required' });
            }
            const agents = await AgentService.getAgentsByDelegation(delegationID);
            logger.info(`Fetched agents by delegation ${delegationID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ agents }); // Wrap in object
        } catch (error) {
            logger.error(`Get agents by delegation error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve agents for delegation' });
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
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve unique locations' });
        }
    }

    /**
     * Get all regions.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with all regions or error.
     */
    static async getAllRegions(req, res) {
        try {
            const regions = await Region.findAll();
            logger.info(`Fetched all regions by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(regions);
        } catch (error) {
            logger.error(`Get all regions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Unable to fetch regions' });
        }
    }

    /**
     * Get all governorates.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with all governorates or error.
     */
    static async getAllGovernorates(req, res) {
        try {
            const governorates = await Governorate.findAll();
            logger.info(`Fetched all governorates by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(governorates);
        } catch (error) {
            logger.error(`Get all governorates error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Unable to fetch governorates' });
        }
    }

    /**
     * Get all delegations.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with all delegations or error.
     */
    static async getAllDelegations(req, res) {
        try {
            const delegations = await Delegation.findAll();
            logger.info(`Fetched all delegations by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(delegations);
        } catch (error) {
            logger.error(`Get all delegations error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Unable to fetch delegations' });
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
                return res.status(400).json({ error: 'Agent ID is required' });
            }
            const supervisor = await AgentService.getAgentSupervisor(id);
            logger.info(`Fetched supervisor for agent ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(supervisor);
        } catch (error) {
            logger.error(`Get agent supervisor error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Supervisor not found for agent' });
        }
    }
}

module.exports = AgentController;