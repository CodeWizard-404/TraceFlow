const { Agent, User, Delegation } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const Role = require('../models/user/role');


class AgentService {
    /**
     * Validate agent input data.
     * @param {Object} data - Agent data to validate.
     * @throws {Error} If validation fails.
     */
    static validateInput({ name, lastname, email, phone, supervisorID, delegationID, agentID }) {
        const errors = [];

        if (name !== undefined && (!name || !/^[a-zA-Z]{2,50}$/.test(name))) {
            errors.push('Name must be 2–50 characters and contain only letters.');
        }

        if (lastname !== undefined && (!lastname || !/^[a-zA-Z]{2,50}$/.test(lastname))) {
            errors.push('Lastname must be 2–50 characters and contain only letters.');
        }

        if (email !== undefined && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            errors.push('Please enter a valid email address.');
        }

        if (phone !== undefined && (!phone || !/^\d{8,12}$/.test(phone))) {
            errors.push('Phone number must be 8–12 digits.');
        }

        if (supervisorID !== undefined && !supervisorID) {
            errors.push('Supervisor ID is required.');
        }

        if (delegationID !== undefined && !delegationID) {
            errors.push('Delegation ID is required.');
        }

        if (agentID !== undefined && !agentID) {
            errors.push('Agent ID is required.');
        }

        if (errors.length > 0) {
            throw new Error(errors.join(' '));
        }
    }

    /**
     * Create a new agent.
     * @param {Object} data - Agent data including name, lastname, email, phone, supervisorID, delegationID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Created agent.
     */
    static async createAgent({ name, lastname, email, phone, supervisorID, delegationID, actorID }) {
        this.validateInput({ name, lastname, email, phone, supervisorID, delegationID });

        // Check for duplicates
        const existingAgent = await Agent.findOne({ where: { [Op.or]: [{ email }, { phone }] } });
        if (existingAgent) {
            const errors = [];
            if (existingAgent.email === email) errors.push('This email is already in use.');
            if (existingAgent.phone === phone) errors.push('This phone number is already in use.');
            throw new Error(errors.join(' '));
        }

        // Validate supervisor
        const supervisor = await User.findByPk(supervisorID, {
            include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
        });
        if (!supervisor) {
            throw new Error('Supervisor not found.');
        }
        if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
            throw new Error('Assigned user is not a supervisor.');
        }

        // Validate delegation
        const delegation = await Delegation.findByPk(delegationID);
        if (!delegation) {
            throw new Error('Delegation not found.');
        }

        // Validate that the delegation is assigned to the supervisor
        const supervisorDelegations = await supervisor.getDelegations();
        if (!supervisorDelegations.some(d => d.delegationID === delegationID)) {
            throw new Error('Delegation not assigned to this supervisor.');
        }

        try {
            const agent = await Agent.create({
                name,
                lastname,
                email,
                phone,
                supervisorID,
                delegationID,
            });
            return agent;
        } catch (error) {
            logger.error(`Create agent error: ${error.message}, user: ${actorID}`);
            throw new Error('Unable to create agent.');
        }
    }

    /**
     * Get all agents.
     * @returns {Promise<Array>} List of all agents.
     */
    static async getAllAgents() {
        try {
            const agents = await Agent.findAll({
                include: [
                    { model: User, as: 'Supervisor', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                    { model: Delegation, attributes: ['delegationID', 'name'] },
                ],
            });
            return agents; // Return empty array if no agents
        } catch (error) {
            logger.error(`Get all agents error: ${error.message}`);
            throw new Error('Failed to retrieve agents.');
        }
    }

    /**
     * Get an agent by ID.
     * @param {string} id - Agent ID.
     * @returns {Promise<Object>} Agent data.
     */
    static async getAgentById(id) {
        try {
            const agent = await Agent.findByPk(id, {
                include: [
                    { model: User, as: 'Supervisor', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                    { model: Delegation, attributes: ['delegationID', 'name'] },
                ],
            });
            if (!agent) {
                const error = new Error('Agent not found.');
                error.status = 404;
                throw error;
            }
            return agent;
        } catch (error) {
            logger.error(`Get agent by ID error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update an agent.
     * @param {string} id - Agent ID.
     * @param {Object} data - Agent data to update.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Updated agent.
     */
    static async updateAgent(id, { name, lastname, email, phone, supervisorID, delegationID, actorID }) {
        this.validateInput({ name, lastname, email, phone, supervisorID, delegationID, agentID: id });

        const agent = await Agent.findByPk(id);
        if (!agent) {
            const error = new Error('Agent not found.');
            error.status = 404;
            throw error;
        }

        // Check for duplicates
        if (email || phone) {
            const existingAgent = await Agent.findOne({
                where: {
                    [Op.or]: [
                        email ? { email } : null,
                        phone ? { phone } : null,
                    ].filter(Boolean),
                    agentID: { [Op.ne]: id },
                },
            });
            if (existingAgent) {
                const errors = [];
                if (email && existingAgent.email === email) errors.push('This email is already in use.');
                if (phone && existingAgent.phone === phone) errors.push('This phone number is already in use.');
                throw new Error(errors.join(' '));
            }
        }

        // Validate supervisor if provided
        if (supervisorID) {
            const supervisor = await User.findByPk(supervisorID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!supervisor) {
                throw new Error('Supervisor not found.');
            }
            if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                throw new Error('Assigned user is not a supervisor.');
            }

            // Validate delegation if provided
            if (delegationID) {
                const delegation = await Delegation.findByPk(delegationID);
                if (!delegation) {
                    throw new Error('Delegation not found.');
                }

                // Validate that the delegation is assigned to the supervisor
                const supervisorDelegations = await supervisor.getDelegations();
                if (!supervisorDelegations.some(d => d.delegationID === delegationID)) {
                    throw new Error('Delegation not assigned to this supervisor.');
                }
            }
        }

        try {
            await agent.update({
                name: name !== undefined ? name : agent.name,
                lastname: lastname !== undefined ? lastname : agent.lastname,
                email: email !== undefined ? email : agent.email,
                phone: phone !== undefined ? phone : agent.phone,
                supervisorID: supervisorID !== undefined ? supervisorID : agent.supervisorID,
                delegationID: delegationID !== undefined ? delegationID : agent.delegationID,
            });
            return agent;
        } catch (error) {
            logger.error(`Update agent error: ${error.message}, user: ${actorID}`);
            throw new Error('Unable to update agent.');
        }
    }

    /**
     * Delete an agent.
     * @param {string} id - Agent ID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<void>}
     */
    static async deleteAgent(id, actorID) {
        this.validateInput({ agentID: id });

        const agent = await Agent.findByPk(id);
        if (!agent) {
            const error = new Error('Agent not found.');
            error.status = 404;
            throw error;
        }

        try {
            await agent.destroy();
        } catch (error) {
            logger.error(`Delete agent error: ${error.message}, user: ${actorID}`);
            throw new Error('Unable to delete agent.');
        }
    }

    /**
     * Get an agent by phone number.
     * @param {string} phone - Agent's phone number.
     * @returns {Promise<Object>} Agent data.
     */
    static async getAgentByPhone(phone) {
        try {
            const agent = await Agent.findOne({
                where: { phone },
                include: [
                    { model: User, as: 'Supervisor', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                    { model: Delegation, attributes: ['delegationID', 'name'] },
                ],
            });
            if (!agent) {
                const error = new Error('Agent not found.');
                error.status = 404;
                throw error;
            }
            return agent;
        } catch (error) {
            logger.error(`Get agent by phone error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get agents by delegation.
     * @param {string} delegationID - Delegation ID.
     * @returns {Promise<Array>} List of agents.
     */
    static async getAgentsByDelegation(delegationID) {
        if (!delegationID) {
            const error = new Error('Delegation ID is required.');
            error.status = 400;
            throw error;
        }

        try {
            const delegation = await Delegation.findByPk(delegationID);
            if (!delegation) {
                const error = new Error('Delegation not found.');
                error.status = 404;
                throw error;
            }

            const agents = await Agent.findAll({
                where: { delegationID },
                include: [
                    { model: User, as: 'Supervisor', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                    { model: Delegation, attributes: ['delegationID', 'name'] },
                ],
            });
            return agents; // Return empty array if no agents
        } catch (error) {
            logger.error(`Get agents by delegation error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all unique agent locations.
     * @returns {Promise<Array>} List of unique locations.
     */
    static async getAllUniqueLocations() {
        try {
            const locations = await Agent.findAll({
                attributes: ['location'],
                group: ['location'],
            });
            const uniqueLocations = locations.map((loc) => loc.location);
            return uniqueLocations;
        } catch (error) {
            logger.error(`Get unique locations error: ${error.message}`);
            const err = new Error('Failed to retrieve unique locations: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    /**
     * Get an agent's supervisor.
     * @param {string} agentID - Agent ID.
     * @returns {Promise<Object>} Supervisor data.
     */
    static async getAgentSupervisor(agentID) {
        this.validateInput({ agentID });

        try {
            const agent = await Agent.findByPk(agentID, {
                include: [
                    {
                        model: User,
                        as: 'Supervisor',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
                        include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
                    },
                ],
            });
            if (!agent) {
                const error = new Error('Agent not found.');
                error.status = 404;
                throw error;
            }
            if (!agent.Supervisor) {
                const error = new Error('No supervisor assigned to this agent.');
                error.status = 404;
                throw error;
            }
            return agent.Supervisor;
        } catch (error) {
            logger.error(`Get agent supervisor error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = AgentService;