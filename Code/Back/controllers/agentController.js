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
                const response = { error: 'All fields are required' };
                logger.error('Create agent failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
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
                const response = { error: result.message, errors: result.errors };
                logger.error('Create agent failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const response = result.agent;
            logger.info('Created agent', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 201 }
            });
            return res.status(201).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Create agent error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
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
            const response = { agents };
            logger.info('Fetched all agents', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Get all agents error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
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
                const response = { error: 'Agent ID is required' };
                logger.error('Get agent by ID failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const agent = await AgentService.getAgentById(id);
            if (!agent) {
                const response = { error: 'Agent not found' };
                logger.error('Get agent by ID failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 404 }
                });
                return res.status(404).json(response);
            }
            const response = agent;
            logger.info('Fetched agent by ID', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Get agent by ID error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
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
                const response = { error: 'Agent ID is required' };
                logger.error('Update agent failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
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
                const response = { error: result.message, errors: result.errors };
                logger.error('Update agent failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const response = result.agent;
            logger.info('Updated agent', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Update agent error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
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
                const response = { error: 'Agent ID is required' };
                logger.error('Delete agent failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const result = await AgentService.deleteAgent(id, req.user.userID);
            if (!result.success) {
                const response = { error: result.message, errors: result.errors };
                logger.error('Delete agent failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const response = { message: 'Agent deleted successfully' };
            logger.info('Deleted agent', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Delete agent error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
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
                const response = { error: 'Phone number is required' };
                logger.error('Get agent by phone failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const agent = await AgentService.getAgentByPhone(phone);
            if (!agent) {
                const response = { error: 'Agent not found' };
                logger.error('Get agent by phone failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 404 }
                });
                return res.status(400).json(response);
            }
            const response = agent;
            logger.info('Fetched agent by phone', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Get agent by phone error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
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
                const response = { error: 'Delegation ID is required' };
                logger.error('Get agents by delegation failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const agents = await AgentService.getAgentsByDelegation(delegationID);
            const response = { agents };
            logger.info('Fetched agents by delegation', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Get agents by delegation error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
        }
    }

    /**
     * Get all unique agent locations.
     * @param {Object} req - Express request object.
     * @param {Object} Xiu - Express response object.
     * @returns {Promise<void>} JSON response with locations or error.
     */
    static async getAllUniqueLocations(req, res) {
        try {
            const locations = await AgentService.getAllUniqueLocations();
            const response = locations;
            logger.info('Fetched unique locations', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Get unique locations error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
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
                const response = { error: 'Agent ID is required' };
                logger.error('Get agent supervisor failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const supervisor = await AgentService.getAgentSupervisor(id);
            if (!supervisor) {
                const response = { error: 'Supervisor not found' };
                logger.error('Get agent supervisor failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 404 }
                });
                return res.status(404).json(response);
            }
            const response = supervisor;
            logger.info('Fetched agent supervisor', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Get agent supervisor error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
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
                const response = { error: 'Supervisor ID is required' };
                logger.error('Get agents by supervisor failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const agents = await AgentService.getAgentsBySupervisor(id);
            const response = { agents };
            logger.info('Fetched agents by supervisor', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Get agents by supervisor error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
        }
    }

    /**
     * Get agents by user.
     * @param {Object} req - Express request object with user ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with agents or error.
     */
    static async getAgentsByUser(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                const response = { error: 'User ID is required' };
                logger.error('Get agents by user failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const agents = await AgentService.getAgentsByUser(id);
            const response = { agents };
            logger.info('Fetched agents by user', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Get agents by user error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
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
                const response = { error: 'Agent ID is required' };
                logger.error('Get user by agent failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const supervisor = await AgentService.getUserByAgent(id);
            if (!supervisor) {
                const response = { error: 'Supervisor not found' };
                logger.error('Get user by agent failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 404 }
                });
                return res.status(404).json(response);
            }
            const response = supervisor;
            logger.info('Fetched user by agent', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Get user by agent error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
        }
    }

    /**
     * Upload and process agents via CSV file.
     * @param {Object} req - Express request object with CSV file in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with processing results or error.
     */
    static async uploadAgents(req, res) {
        try {
            if (!req.file) {
                const response = { error: 'No CSV file uploaded' };
                logger.error('Upload agents failed', {
                    traceId: req.traceId,
                    route: 'agents',
                    service: 'api',
                    metadata: { response, status: 400 }
                });
                return res.status(400).json(response);
            }
            const results = await AgentService.processAgentCSV(req.file.buffer, req.user.userID);
            const response = results;
            logger.info('Processed agent CSV', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 200 }
            });
            return res.status(200).json(response);
        } catch (error) {
            const response = { error: 'Internal server error' };
            logger.error('Upload agents error', {
                traceId: req.traceId,
                route: 'agents',
                service: 'api',
                metadata: { response, status: 500 }
            });
            return res.status(500).json(response);
        }
    }
}

module.exports = AgentController;