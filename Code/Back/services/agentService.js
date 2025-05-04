const { Agent, User, Delegation, Role } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class AgentService {
    /**
     * Validate agent input data.
     * @param {Object} data - Agent data to validate.
     * @returns {Object} - Validation result with errors array
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

        return { isValid: errors.length === 0, errors };
    }

    /**
     * Create a new agent.
     * @param {Object} data - Agent data including name, lastname, email, phone, supervisorID, delegationID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Created agent or error response.
     */
    static async createAgent({ name, lastname, email, phone, supervisorID, delegationID, actorID }) {
        const validation = this.validateInput({ name, lastname, email, phone, supervisorID, delegationID });
        if (!validation.isValid) {
            return { success: false, message: 'Validation failed', errors: validation.errors };
        }

        try {
            const existingAgent = await Agent.findOne({ where: { [Op.or]: [{ email }, { phone }] } });
            if (existingAgent) {
                const errors = [];
                if (existingAgent.email === email) errors.push('This email is already in use.');
                if (existingAgent.phone === phone) errors.push('This phone number is already in use.');
                return { success: false, message: 'Duplicate agent', errors };
            }

            const supervisor = await User.findByPk(supervisorID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!supervisor) {
                return { success: false, message: 'Supervisor not found' };
            }
            if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                return { success: false, message: 'Assigned user is not a supervisor' };
            }

            const delegation = await Delegation.findByPk(delegationID);
            if (!delegation) {
                return { success: false, message: 'Delegation not found' };
            }

            const supervisorDelegations = await supervisor.getDelegations();
            if (!supervisorDelegations.some(d => d.delegationID === delegationID)) {
                return { success: false, message: 'Delegation not assigned to this supervisor' };
            }

            const agent = await Agent.create({
                name,
                lastname,
                email,
                phone,
                supervisorID,
                delegationID,
            });
            return { success: true, agent };
        } catch (error) {
            logger.error(`Create agent error: ${error.message}, user: ${actorID}`);
            return { success: false, message: 'Unable to create agent' };
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
            return agents || [];
        } catch (error) {
            logger.error(`Get all agents error: ${error.message}`);
            return [];
        }
    }

    /**
     * Get an agent by ID.
     * @param {string} id - Agent ID.
     * @returns {Promise<Object>} Agent data or null.
     */
    static async getAgentById(id) {
        const validation = this.validateInput({ agentID: id });
        if (!validation.isValid) {
            logger.warn(`Invalid agentID: ${id}`);
            return null;
        }

        try {
            const agent = await Agent.findByPk(id, {
                include: [
                    { model: User, as: 'Supervisor', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                    { model: Delegation, attributes: ['delegationID', 'name'] },
                ],
            });
            return agent || null;
        } catch (error) {
            logger.error(`Get agent by ID error: ${error.message}`);
            return null;
        }
    }

    /**
     * Update an agent.
     * @param {string} id - Agent ID.
     * @param {Object} data - Agent data to update.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Updated agent or error response.
     */
    static async updateAgent(id, { name, lastname, email, phone, supervisorID, delegationID, actorID }) {
        const validation = this.validateInput({ name, lastname, email, phone, supervisorID, delegationID, agentID: id });
        if (!validation.isValid) {
            return { success: false, message: 'Validation failed', errors: validation.errors };
        }

        try {
            const agent = await Agent.findByPk(id);
            if (!agent) {
                return { success: false, message: 'Agent not found' };
            }

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
                    return { success: false, message: 'Duplicate agent', errors };
                }
            }

            if (supervisorID) {
                const supervisor = await User.findByPk(supervisorID, {
                    include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
                });
                if (!supervisor) {
                    return { success: false, message: 'Supervisor not found' };
                }
                if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                    return { success: false, message: 'Assigned user is not a supervisor' };
                }

                if (delegationID) {
                    const delegation = await Delegation.findByPk(delegationID);
                    if (!delegation) {
                        return { success: false, message: 'Delegation not found' };
                    }

                    const supervisorDelegations = await supervisor.getDelegations();
                    if (!supervisorDelegations.some(d => d.delegationID === delegationID)) {
                        return { success: false, message: 'Delegation not assigned to this supervisor' };
                    }
                }
            }

            await agent.update({
                name: name !== undefined ? name : agent.name,
                lastname: lastname !== undefined ? lastname : agent.lastname,
                email: email !== undefined ? email : agent.email,
                phone: phone !== undefined ? phone : agent.phone,
                supervisorID: supervisorID !== undefined ? supervisorID : agent.supervisorID,
                delegationID: delegationID !== undefined ? delegationID : agent.delegationID,
            });
            return { success: true, agent };
        } catch (error) {
            logger.error(`Update agent error: ${error.message}, user: ${actorID}`);
            return { success: false, message: 'Unable to update agent' };
        }
    }

    /**
     * Delete an agent.
     * @param {string} id - Agent ID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Success message or error response.
     */
    static async deleteAgent(id, actorID) {
        const validation = this.validateInput({ agentID: id });
        if (!validation.isValid) {
            return { success: false, message: 'Invalid agent ID', errors: validation.errors };
        }

        try {
            const agent = await Agent.findByPk(id);
            if (!agent) {
                return { success: false, message: 'Agent not found' };
            }

            await agent.destroy();
            return { success: true, message: 'Agent deleted successfully' };
        } catch (error) {
            logger.error(`Delete agent error: ${error.message}, user: ${actorID}`);
            return { success: false, message: 'Unable to delete agent' };
        }
    }

    /**
     * Get an agent by phone number.
     * @param {string} phone - Agent's phone number.
     * @returns {Promise<Object>} Agent data or null.
     */
    static async getAgentByPhone(phone) {
        const validation = this.validateInput({ phone });
        if (!validation.isValid) {
            logger.warn(`Invalid phone: ${phone}`);
            return null;
        }

        try {
            const agent = await Agent.findOne({
                where: { phone },
                include: [
                    { model: User, as: 'Supervisor', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                    { model: Delegation, attributes: ['delegationID', 'name'] },
                ],
            });
            return agent || null;
        } catch (error) {
            logger.error(`Get agent by phone error: ${error.message}`);
            return null;
        }
    }

    /**
     * Get agents by delegation.
     * @param {string} delegationID - Delegation ID.
     * @returns {Promise<Array>} List of agents.
     */
    static async getAgentsByDelegation(delegationID) {
        const validation = this.validateInput({ delegationID });
        if (!validation.isValid) {
            logger.warn(`Invalid delegationID: ${delegationID}`);
            return [];
        }

        try {
            const delegation = await Delegation.findByPk(delegationID);
            if (!delegation) {
                return [];
            }

            const agents = await Agent.findAll({
                where: { delegationID },
                include: [
                    { model: User, as: 'Supervisor', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                    { model: Delegation, attributes: ['delegationID', 'name'] },
                ],
            });
            return agents || [];
        } catch (error) {
            logger.error(`Get agents by delegation error: ${error.message}, delegationID: ${delegationID}`);
            return [];
        }
    }

    /**
     * Get all unique agent locations.
     * @returns {Promise<Array>} List of unique locations.
     */
    static async getAllUniqueLocations() {
        try {
            const delegations = await Delegation.findAll({
                attributes: ['name'],
                include: [{
                    model: Agent,
                    attributes: [],
                    required: true
                }],
                distinct: true,
            });
            return [...new Set(delegations.map(delegation => delegation.name))] || [];
        } catch (error) {
            logger.error(`Get unique locations error: ${error.message}`);
            return [];
        }
    }

    /**
     * Get an agent's supervisor.
     * @param {string} agentID - Agent ID.
     * @returns {Promise<Object>} Supervisor data or null.
     */
    static async getAgentSupervisor(agentID) {
        const validation = this.validateInput({ agentID });
        if (!validation.isValid) {
            logger.warn(`Invalid agentID: ${agentID}`);
            return null;
        }

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
            return agent?.Supervisor || null;
        } catch (error) {
            logger.error(`Get agent supervisor error: ${error.message}`);
            return null;
        }
    }

    /**
     * Get all the agents of a supervisor.
     * @param {string} supervisorID - Supervisor ID.
     * @returns {Promise<Array>} List of agents.
     */
    static async getAgentsBySupervisor(supervisorID) {
        const validation = this.validateInput({ supervisorID });
        if (!validation.isValid) {
            logger.warn(`Invalid supervisorID: ${supervisorID}`);
            return [];
        }

        try {
            const supervisor = await User.findByPk(supervisorID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!supervisor || !supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                return [];
            }

            const agents = await Agent.findAll({
                where: { supervisorID },
                include: [
                    { model: User, as: 'Supervisor', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                    { model: Delegation, attributes: ['delegationID', 'name'] },
                ],
            });
            return agents || [];
        } catch (error) {
            logger.error(`Get agents by supervisor error: ${error.message}`);
            return [];
        }
    }

    /**
     * Get agents by user (supervisor).
     * @param {string} userID - User ID (Supervisor).
     * @returns {Promise<Array>} List of agents.
     */
    static async getAgentsByUser(userID) {
        const validation = this.validateInput({ userID });
        if (!validation.isValid) {
            logger.warn(`Invalid userID: ${userID}`);
            return [];
        }

        try {
            const supervisor = await User.findByPk(userID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!supervisor || !supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                return [];
            }

            const agents = await Agent.findAll({
                where: { supervisorID: userID },
                include: [
                    { model: User, as: 'Supervisor', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                    { model: Delegation, attributes: ['delegationID', 'name'] },
                ],
            });
            return agents || [];
        } catch (error) {
            logger.error(`Get agents by user error: ${error.message}, userID: ${userID}`);
            return [];
        }
    }

    /**
     * Get user (supervisor) by agent.
     * @param {string} agentID - Agent ID.
     * @returns {Promise<Object>} Supervisor data or null.
     */
    static async getUserByAgent(agentID) {
        const validation = this.validateInput({ agentID });
        if (!validation.isValid) {
            logger.warn(`Invalid agentID: ${agentID}`);
            return null;
        }

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
            return agent?.Supervisor || null;
        } catch (error) {
            logger.error(`Get user by agent error: ${error.message}, agentID: ${agentID}`);
            return null;
        }
    }
}

module.exports = AgentService;