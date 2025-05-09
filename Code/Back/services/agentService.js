const csv = require('csv-parse');
const { Readable } = require('stream');
const { Op } = require('sequelize');
const iconv = require('iconv-lite');
const Agent = require('../models').Agent;
const User = require('../models').User;
const Role = require('../models').Role;
const Delegation = require('../models').Delegation;
const Governorate = require('../models').Governorate;
const CsvHeader = require('../models').CsvHeader;
const UserService = require('./userService');

class AgentService {
    /**
     * Validate agent input data.
     * @param {Object} data - Agent data to validate.
     * @returns {Object} - Validation result with errors array
     */
    static validateInput({ name, lastname, email, phone, supervisorID, delegationID, agentID }) {
        const errors = [];

        if (name !== undefined && (!name || !/^[a-zA-Z\s\u00C0-\u017F]{2,50}$/.test(name))) {
            errors.push('First name must be 2–50 characters and contain only letters, spaces, or accented characters.');
        }

        if (lastname !== undefined && (!lastname || !/^[a-zA-Z\s\u00C0-\u017F]{2,50}$/.test(lastname))) {
            errors.push('Last name must be 2–50 characters and contain only letters, spaces, or accented characters.');
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
                    {
                        model: User,
                        as: 'Supervisor',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone']
                    },
                    {
                        model: Delegation,
                        attributes: ['delegationID', 'name'],
                        include: [
                            {
                                model: Governorate,
                                attributes: ['governorateID', 'name']
                            }
                        ]
                    },
                ],
            });
            return agents || [];
        } catch (error) {
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
            return null;
        }

        try {
            const agent = await Agent.findByPk(id, {
                include: [
                    {
                        model: User,
                        as: 'Supervisor',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone']
                    },
                    {
                        model: Delegation,
                        attributes: ['delegationID', 'name'],
                        include: [
                            {
                                model: Governorate,
                                attributes: ['governorateID', 'name']
                            }
                        ]
                    },
                ],
            });
            return agent || null;
        } catch (error) {
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
            return null;
        }

        try {
            const agent = await Agent.findOne({
                where: { phone },
                include: [
                    {
                        model: User,
                        as: 'Supervisor',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone']
                    },
                    {
                        model: Delegation,
                        attributes: ['delegationID', 'name'],
                        include: [
                            {
                                model: Governorate,
                                attributes: ['governorateID', 'name']
                            }
                        ]
                    },
                ],
            });
            return agent || null;
        } catch (error) {
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
                    {
                        model: User,
                        as: 'Supervisor',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone']
                    },
                    {
                        model: Delegation,
                        attributes: ['delegationID', 'name'],
                        include: [
                            {
                                model: Governorate,
                                attributes: ['governorateID', 'name']
                            }
                        ]
                    },
                ],
            });
            return agents || [];
        } catch (error) {
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
                    {
                        model: User,
                        as: 'Supervisor',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone']
                    },
                    {
                        model: Delegation,
                        attributes: ['delegationID', 'name'],
                        include: [
                            {
                                model: Governorate,
                                attributes: ['governorateID', 'name']
                            }
                        ]
                    },
                ],
            });
            return agents || [];
        } catch (error) {
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
                    {
                        model: User,
                        as: 'Supervisor',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone']
                    },
                    {
                        model: Delegation,
                        attributes: ['delegationID', 'name'],
                        include: [
                            {
                                model: Governorate,
                                attributes: ['governorateID', 'name']
                            }
                        ]
                    },
                ],
            });
            return agents || [];
        } catch (error) {
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
            return null;
        }
    }

    /**
     * Process agent CSV file.
     * @param {Object} file - Uploaded CSV file object.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Detailed processing results.
     */
    static async processAgentCSV(fileBuffer, actorID) {
        const results = {
            status: 'pending',
            summary: {
                totalRecords: 0,
                agentsCreated: 0,
                agentsUpdated: 0,
                recordsSkipped: 0,
                errorsEncountered: 0,
            },
            detailedLog: {
                created: [],
                updated: [],
                skipped: [],
                errors: [],
            },
        };


        // Attempt to decode buffer
        let bufferString;
        try {
            bufferString = fileBuffer.toString(process.env.CSV_ENCODING || 'utf8');
            if (bufferString.includes('\uFFFD')) {
                bufferString = iconv.decode(fileBuffer, process.env.CSV_FALLBACK_ENCODING || 'win1252');
            }
        } catch (error) {
            try {
                bufferString = iconv.decode(fileBuffer, process.env.CSV_FALLBACK_ENCODING || 'win1252');
            } catch (fallbackError) {
                results.detailedLog.errors.push({
                    agentPhone: 'N/A',
                    agentName: 'N/A',
                    timestamp: new Date().toISOString(),
                    operation: 'CSV parsing',
                    reason: `Failed to decode buffer: ${fallbackError.message}`,
                });
                results.summary.errorsEncountered++;
                return results;
            }
        }

        // Fetch header mappings
        const headerMappings = await CsvHeader.findAll({ where: { csvType: 'agent' } });
        const headerMap = headerMappings.reduce((map, header) => {
            map[header.mappedHeader] = header.expectedHeader;
            return map;
        }, {});

        // Parse CSV with dynamic column mapping
        const parser = Readable.from(bufferString).pipe(
            csv.parse({
                columns: header => header.map(h => headerMap[h] || h), // Map CSV headers to expected headers
                skip_empty_lines: true,
                trim: true,
                bom: true,
                delimiter: process.env.CSV_DELIMITER || ',',
                quote: process.env.CSV_QUOTE || '"',
            })
        );

        for await (const record of parser) {
            results.summary.totalRecords++;
            const {
                firstname,
                lastname,
                email,
                phone,
                delegation,
                governorate,
                supervisor_phone,
            } = record;

            // Validate required fields
            if (!firstname || !lastname || !email || !phone || !delegation || !governorate || !supervisor_phone) {
                results.detailedLog.skipped.push({
                    agentPhone: phone || 'N/A',
                    agentName: `${firstname || ''} ${lastname || ''}`.trim() || 'Unnamed',
                    timestamp: new Date().toISOString(),
                    reason: 'One or more required fields are missing',
                });
                results.summary.recordsSkipped++;
                continue;
            }

            const transaction = await Agent.sequelize.transaction();
            try {
                // Fetch supervisor
                const supervisor = await User.findOne({
                    where: { phone: supervisor_phone },
                    include: [
                        { model: Role, through: { attributes: [] }, attributes: ['name'] },
                        { model: Delegation, through: { attributes: [] } },
                    ],
                    transaction,
                });

                if (!supervisor || !supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                    results.detailedLog.skipped.push({
                        agentPhone: phone,
                        agentName: `${firstname} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        reason: `No valid supervisor found with phone number ${supervisor_phone}`,
                    });
                    results.summary.recordsSkipped++;
                    await transaction.rollback();
                    continue;
                }

                // Prevent self-supervision
                if (phone === supervisor_phone) {
                    results.detailedLog.skipped.push({
                        agentPhone: phone,
                        agentName: `${firstname} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        reason: 'Agent phone number matches supervisor phone number; self-supervision is not allowed',
                    });
                    results.summary.recordsSkipped++;
                    await transaction.rollback();
                    continue;
                }

                // Perform case-insensitive search for delegation
                const delegationRecord = await Delegation.findOne({
                    where: {
                        name: {
                            [Op.iLike]: delegation,
                        },
                    },
                    transaction,
                });
                if (!delegationRecord) {
                    results.detailedLog.errors.push({
                        agentPhone: phone,
                        agentName: `${firstname} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: 'Delegation lookup',
                        reason: `Delegation '${delegation}' not found in the system`,
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }

                // Perform case-insensitive search for governorate
                const governorateRecord = await Governorate.findOne({
                    where: {
                        name: {
                            [Op.iLike]: governorate,
                        },
                    },
                    transaction,
                });
                if (!governorateRecord) {
                    results.detailedLog.errors.push({
                        agentPhone: phone,
                        agentName: `${firstname} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: 'Governorate lookup',
                        reason: `Governorate '${governorate}' not found in the system`,
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }

                // Assign governorate to supervisor
                const governorateAssignment = await UserService.assignGovernorateToUser(
                    supervisor.userID,
                    governorateRecord.governorateID,
                    actorID,
                    { transaction }
                );
                if (!governorateAssignment.success) {
                    results.detailedLog.errors.push({
                        agentPhone: phone,
                        agentName: `${firstname} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: 'Governorate assignment',
                        reason: `Failed to assign governorate '${governorate}' to supervisor ${supervisor_phone}: ${governorateAssignment.message}`,
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }

                // Assign delegation to supervisor
                const delegationAssignment = await UserService.assignDelegationToUser(
                    supervisor.userID,
                    delegationRecord.delegationID,
                    actorID,
                    { transaction }
                );
                if (!delegationAssignment.success) {
                    results.detailedLog.errors.push({
                        agentPhone: phone,
                        agentName: `${firstname} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: 'Delegation assignment',
                        reason: `Failed to assign delegation '${delegation}' to supervisor ${supervisor_phone}: ${delegationAssignment.message}`,
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }

                // Check for existing agent
                let existingAgent = await this.getAgentByPhone(phone, { transaction });

                if (!existingAgent && email) {
                    existingAgent = await Agent.findOne({ where: { email }, transaction });
                }

                let agentResult;

                if (existingAgent) {
                    // Update existing agent
                    agentResult = await this.updateAgent(existingAgent.agentID, {
                        name: firstname,
                        lastname,
                        email,
                        phone,
                        supervisorID: supervisor.userID,
                        delegationID: delegationRecord.delegationID,
                        actorID,
                    }, { transaction });

                    if (agentResult.success) {
                        results.detailedLog.updated.push({
                            agentPhone: phone,
                            agentName: `${firstname} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            details: `Agent updated with email '${email}', assigned to delegation '${delegation}' and supervisor ${supervisor_phone}`,
                        });
                        results.summary.agentsUpdated++;
                    } else {
                        results.detailedLog.errors.push({
                            agentPhone: phone,
                            agentName: `${firstname} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            operation: 'Agent update',
                            reason: `Failed to update agent: ${agentResult.message}`,
                        });
                        results.summary.errorsEncountered++;
                        await transaction.rollback();
                        continue;
                    }
                } else {
                    // Create new agent
                    agentResult = await this.createAgent({
                        name: firstname,
                        lastname,
                        email,
                        phone,
                        supervisorID: supervisor.userID,
                        delegationID: delegationRecord.delegationID,
                        actorID,
                    }, { transaction });

                    if (agentResult.success) {
                        results.detailedLog.created.push({
                            agentPhone: phone,
                            agentName: `${firstname} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            details: `Agent created with email '${email}', assigned to delegation '${delegation}' and supervisor ${supervisor_phone}`,
                        });
                        results.summary.agentsCreated++;
                    } else {
                        results.detailedLog.errors.push({
                            agentPhone: phone,
                            agentName: `${firstname} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            operation: 'Agent creation',
                            reason: `Failed to create agent: ${agentResult.message}`,
                        });
                        results.summary.errorsEncountered++;
                        await transaction.rollback();
                        continue;
                    }
                }

                // Assign supervisor to agent
                const supervisorAssignment = await UserService.assignSupervisorToAgent(
                    agentResult.agent.agentID,
                    supervisor.userID,
                    delegationRecord.delegationID,
                    actorID,
                    { transaction }
                );
                if (!supervisorAssignment.success) {
                    results.detailedLog.errors.push({
                        agentPhone: phone,
                        agentName: `${firstname} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: 'Supervisor assignment',
                        reason: `Failed to assign supervisor: ${supervisorAssignment.message}`,
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }

                await transaction.commit();
            } catch (error) {
                await transaction.rollback();
                results.detailedLog.errors.push({
                    agentPhone: phone || 'N/A',
                    agentName: `${firstname || ''} ${lastname || ''}`.trim() || 'Unnamed',
                    timestamp: new Date().toISOString(),
                    operation: 'Record processing',
                    reason: `Unexpected error occurred: ${error.message}`,
                });
                results.summary.errorsEncountered++;
            }
        }

        // Determine overall status
        results.status = results.summary.errorsEncountered === 0 && results.summary.recordsSkipped === 0
            ? 'completed_successfully'
            : (results.summary.agentsCreated > 0 || results.summary.agentsUpdated > 0
                ? 'completed_with_issues'
                : 'failed');


        return results;
    }
}

module.exports = AgentService;