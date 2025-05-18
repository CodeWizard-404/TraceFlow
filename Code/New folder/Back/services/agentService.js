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
const GoogleMapsService = require('./googleMapsService');

// Define mandatory and optional headers
const MANDATORY_HEADERS = [
    { csvHeader: 'firstname', backend: 'name' },
    { csvHeader: 'lastname', backend: 'lastname' },
    { csvHeader: 'phone', backend: 'phone' },
    { csvHeader: 'email', backend: 'email' },
    { csvHeader: 'delegation', backend: 'delegationID' },
    { csvHeader: 'supervisor_phone', backend: 'supervisorID' },
];

const OPTIONAL_HEADERS = [
    { csvHeader: 'governorate', backend: 'governorate' },
    { csvHeader: 'adress', backend: 'lat,lng' },
    { csvHeader: 'latitude', backend: 'lat' },
    { csvHeader: 'longtitude', backend: 'lng' },
];

class AgentService {
    /**
     * Validate agent input data.
     * @param {Object} data - Agent data to validate.
     * @returns {Object} - Validation result with errors array
     */
    static validateInput({ name, lastname, email, phone, supervisorID, delegationID, agentID, latitude, longitude, locationAddress }) {
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
        if (latitude !== undefined && (isNaN(latitude) || latitude < -90 || latitude > 90)) {
            errors.push('Latitude must be a number between -90 and 90.');
        }
        if (longitude !== undefined && (isNaN(longitude) || longitude < -180 || longitude > 180)) {
            errors.push('Longitude must be a number between -180 and 180.');
        }
        return { isValid: errors.length === 0, errors };
    }

    /**
     * Create a new agent.
     * @param {Object} data - Agent data including name, lastname, email, phone, supervisorID, delegationID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Created agent or error response.
     */
    static async createAgent({ name, lastname, email, phone, supervisorID, delegationID, latitude, longitude, locationAddress, actorID }) {
        const validation = this.validateInput({ name, lastname, email, phone, supervisorID, delegationID, latitude, longitude, locationAddress });
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
            if (!supervisor || !supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                return { success: false, message: 'Supervisor not found or not a supervisor' };
            }

            const delegation = await Delegation.findByPk(delegationID);
            if (!delegation) {
                return { success: false, message: 'Delegation not found' };
            }

            const supervisorDelegations = await supervisor.getDelegations();
            if (!supervisorDelegations.some(d => d.delegationID === delegationID)) {
                return { success: false, message: 'Delegation not assigned to this supervisor' };
            }

            let finalLat = latitude;
            let finalLng = longitude;
            if (locationAddress && !latitude && !longitude) {
                const geocode = await GoogleMapsService.geocodeAddress(locationAddress);
                finalLat = geocode.latitude;
                finalLng = geocode.longitude;
            }

            const agent = await Agent.create({
                name,
                lastname,
                email,
                phone,
                supervisorID,
                delegationID,
                latitude: finalLat,
                longitude: finalLng,
                location: finalLat && finalLng ? `${finalLat},${finalLng}` : null,
            });
            return { success: true, agent };
        } catch (error) {
            return { success: false, message: `Unable to create agent: ${error.message}` };
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
    static async updateAgent(id, { name, lastname, email, phone, supervisorID, delegationID, latitude, longitude, locationAddress, actorID }) {
        const validation = this.validateInput({ name, lastname, email, phone, supervisorID, delegationID, agentID: id, latitude, longitude });
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
                if (!supervisor || !supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                    return { success: false, message: 'Supervisor not found or not a supervisor' };
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

            let finalLat = latitude !== undefined ? latitude : agent.latitude;
            let finalLng = longitude !== undefined ? longitude : agent.longitude;
            if (locationAddress && latitude === undefined && longitude === undefined) {
                const geocode = await GoogleMapsService.geocodeAddress(locationAddress);
                finalLat = geocode.latitude;
                finalLng = geocode.longitude;
            }

            await agent.update({
                name: name !== undefined ? name : agent.name,
                lastname: lastname !== undefined ? lastname : agent.lastname,
                email: email !== undefined ? email : agent.email,
                phone: phone !== undefined ? phone : agent.phone,
                supervisorID: supervisorID !== undefined ? supervisorID : agent.supervisorID,
                delegationID: delegationID !== undefined ? delegationID : agent.delegationID,
                latitude: finalLat,
                longitude: finalLng,
                location: finalLat && finalLng ? `${finalLat},${finalLng}` : agent.location,
            });
            return { success: true, agent };
        } catch (error) {
            return { success: false, message: `Unable to update agent: ${error.message}` };
        }
    }

    /**
       * Process agent CSV file.
       * @param {Buffer} fileBuffer - Uploaded CSV file buffer.
       * @param {string} actorID - ID of the user performing the action.
       * @returns {Promise<Object>} Detailed processing results.
       */
    static async processAgentCSV(fileBuffer, actorID) {
        const results = {
            status: "pending",
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

        // Decode buffer with fallback encoding
        let bufferString;
        try {
            bufferString = fileBuffer.toString(process.env.CSV_ENCODING || "utf8");
            if (bufferString.includes("\uFFFD")) {
                bufferString = iconv.decode(fileBuffer, process.env.CSV_FALLBACK_ENCODING || "win1252");
            }
        } catch (fallbackError) {
            results.detailedLog.errors.push({
                agentPhone: "N/A",
                agentName: "N/A",
                timestamp: new Date().toISOString(),
                operation: "CSV parsing",
                reason: `Failed to decode buffer: ${fallbackError.message}`,
            });
            results.summary.errorsEncountered++;
            return results;
        }

        // Fetch header mappings
        const headerMappings = await CsvHeader.findAll({ where: { csvType: "agent" } });
        const headerMap = headerMappings.reduce((map, header) => {
            map[header.mappedHeader] = header.expectedHeader;
            return map;
        }, {});

        // Extract and validate CSV headers
        const firstLine = bufferString.split("\n")[0].trim();
        if (!firstLine) {
            results.detailedLog.errors.push({
                agentPhone: "N/A",
                agentName: "N/A",
                timestamp: new Date().toISOString(),
                operation: "CSV parsing",
                reason: "CSV file is empty or has no headers",
            });
            results.summary.errorsEncountered++;
            return results;
        }
        const csvHeaders = firstLine.split(",").map((h) => h.trim()).filter(Boolean);

        // Validate mandatory headers
        // Validate mandatory headers
        const mandatoryCsvHeaders = MANDATORY_HEADERS.map((h) => h.csvHeader);
        const mappedHeaders = headerMappings.map((h) => h.mappedHeader);
        const missingMandatory = mandatoryCsvHeaders.filter((mandatoryHeader) => {
            // Find the mapped header for this mandatory header
            const mapping = headerMappings.find((h) => h.expectedHeader === mandatoryHeader);
            // Check if the mapped header (or the mandatory header itself) exists in the CSV
            return !mapping || !csvHeaders.includes(mapping.mappedHeader);
        });
        if (missingMandatory.length > 0) {
            results.detailedLog.errors.push({
                agentPhone: "N/A",
                agentName: "N/A",
                timestamp: new Date().toISOString(),
                operation: "Header validation",
                reason: `Missing required headers: ${missingMandatory.join(", ")}`,
            });
            results.summary.errorsEncountered++;
            return results;
        }

        // Validate header mappings
        const unmappedMandatory = mandatoryCsvHeaders.filter((h) => !mappedHeaders.includes(h));
        if (unmappedMandatory.length > 0) {
            results.detailedLog.errors.push({
                agentPhone: "N/A",
                agentName: "N/A",
                timestamp: new Date().toISOString(),
                operation: "Header mapping",
                reason: `Required headers not mapped: ${unmappedMandatory.join(", ")}`,
            });
            results.summary.errorsEncountered++;
            return results;
        }

        // Parse CSV with dynamic column mapping
        const parser = Readable.from(bufferString).pipe(
            csv.parse({
                columns: (header) => header.map((h) => headerMap[h] || h),
                skip_empty_lines: true,
                trim: true,
                bom: true,
                delimiter: process.env.CSV_DELIMITER || ",",
                quote: process.env.CSV_QUOTE || '"',
            })
        );

        for await (const record of parser) {
            results.summary.totalRecords++;
            const {
                name,
                lastname,
                email,
                phone,
                delegation,
                supervisor_phone,
                governorate,
                adress: address,
                lat: latitude,
                lng: longitude,
            } = record;

            // Validate required fields with specific skip reasons
            const missingFields = [];
            if (!name) missingFields.push("firstname");
            if (!lastname) missingFields.push("lastname");
            if (!email) missingFields.push("email");
            if (!phone) missingFields.push("phone");
            if (!delegation) missingFields.push("delegation");
            if (!supervisor_phone) missingFields.push("supervisor_phone");

            if (missingFields.length > 0) {
                results.detailedLog.skipped.push({
                    agentPhone: phone || "N/A",
                    agentName: `${name || "Unknown"} ${lastname || "Unknown"}`.trim(),
                    timestamp: new Date().toISOString(),
                    reason: `Missing required fields: ${missingFields.join(", ")}`,
                });
                results.summary.recordsSkipped++;
                continue;
            }

            const transaction = await Agent.sequelize.transaction();
            try {
                // Validate input data using validateInput method
                const validation = this.validateInput({
                    name,
                    lastname,
                    email,
                    phone,
                    supervisorID: supervisor_phone, // Temporary, will be resolved later
                    delegationID: delegation, // Temporary, will be resolved later
                    latitude: latitude ? parseFloat(latitude) : undefined,
                    longitude: longitude ? parseFloat(longitude) : undefined,
                });

                if (!validation.isValid) {
                    results.detailedLog.skipped.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        reason: `Input validation failed: ${validation.errors.join("; ")}`,
                    });
                    results.summary.recordsSkipped++;
                    await transaction.rollback();
                    continue;
                }

                // Resolve supervisor by phone
                const supervisor = await User.findOne({
                    where: { phone: supervisor_phone },
                    include: [
                        { model: Role, through: { attributes: [] }, attributes: ["name"] },
                        { model: Delegation, through: { attributes: [] } },
                    ],
                    transaction,
                });

                if (!supervisor) {
                    results.detailedLog.skipped.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        reason: `No user found with supervisor phone number '${supervisor_phone}'`,
                    });
                    results.summary.recordsSkipped++;
                    await transaction.rollback();
                    continue;
                }

                if (!supervisor.Roles.some((role) => role.name === process.env.ROLE_SUPERVISOR)) {
                    results.detailedLog.skipped.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        reason: `User with phone '${supervisor_phone}' is not assigned the supervisor role`,
                    });
                    results.summary.recordsSkipped++;
                    await transaction.rollback();
                    continue;
                }

                // Prevent self-supervision
                if (phone === supervisor_phone) {
                    results.detailedLog.skipped.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        reason: "Self-supervision is not allowed: agent phone matches supervisor phone",
                    });
                    results.summary.recordsSkipped++;
                    await transaction.rollback();
                    continue;
                }

                // Resolve delegation by name
                const delegationRecord = await Delegation.findOne({
                    where: { name: { [Op.iLike]: delegation } },
                    transaction,
                });
                if (!delegationRecord) {
                    results.detailedLog.errors.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: "Delegation lookup",
                        reason: `Delegation '${delegation}' not found in the system`,
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }

                // Validate supervisor's delegation assignment
                const supervisorDelegations = supervisor.Delegations.map(d => d.delegationID);
                if (!supervisorDelegations.includes(delegationRecord.delegationID)) {
                    results.detailedLog.skipped.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        reason: `Supervisor with phone '${supervisor_phone}' is not assigned to delegation '${delegation}'`,
                    });
                    results.summary.recordsSkipped++;
                    await transaction.rollback();
                    continue;
                }

                // Validate governorate if provided
                if (governorate) {
                    const governorateRecord = await Governorate.findOne({
                        where: { name: { [Op.iLike]: governorate } },
                        transaction,
                    });
                    if (!governorateRecord) {
                        results.detailedLog.errors.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            operation: "Governorate lookup",
                            reason: `Governorate '${governorate}' not found in the system`,
                        });
                        results.summary.errorsEncountered++;
                        await transaction.rollback();
                        continue;
                    }

                    if (delegationRecord.governorateID !== governorateRecord.governorateID) {
                        results.detailedLog.errors.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            operation: "Governorate validation",
                            reason: `Delegation '${delegation}' does not belong to governorate '${governorate}'`,
                        });
                        results.summary.errorsEncountered++;
                        await transaction.rollback();
                        continue;
                    }
                }

                // Assign governorate to supervisor if provided
                if (governorate) {
                    const governorateRecord = await Governorate.findOne({
                        where: { name: { [Op.iLike]: governorate } },
                        transaction,
                    });
                    if (governorateRecord) {
                        const governorateAssignment = await UserService.assignGovernorateToUser(
                            supervisor.userID,
                            governorateRecord.governorateID,
                            actorID,
                            { transaction }
                        );
                        if (!governorateAssignment.success) {
                            results.detailedLog.errors.push({
                                agentPhone: phone,
                                agentName: `${name} ${lastname}`,
                                timestamp: new Date().toISOString(),
                                operation: "Governorate assignment",
                                reason: `Failed to assign governorate '${governorate}' to supervisor ${supervisor_phone}: ${governorateAssignment.message}`,
                            });
                            results.summary.errorsEncountered++;
                            await transaction.rollback();
                            continue;
                        }
                    }
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
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: "Delegation assignment",
                        reason: `Failed to assign delegation '${delegation}' to supervisor ${supervisor_phone}: ${delegationAssignment.message}`,
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }

                // Handle location data
                let finalLat = latitude ? parseFloat(latitude) : null;
                let finalLng = longitude ? parseFloat(longitude) : null;
                if (address && !latitude && !longitude) {
                    try {
                        const geocode = await GoogleMapsService.geocodeAddress(address);
                        finalLat = geocode.latitude;
                        finalLng = geocode.longitude;
                    } catch (error) {
                        results.detailedLog.errors.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            operation: "Geocoding",
                            reason: `Failed to geocode address '${address}': ${error.message}`,
                        });
                        results.summary.errorsEncountered++;
                        await transaction.rollback();
                        continue;
                    }
                }

                // Validate location data
                if (finalLat !== null && (isNaN(finalLat) || finalLat < -90 || finalLat > 90)) {
                    results.detailedLog.errors.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: "Location validation",
                        reason: "Latitude must be a number between -90 and 90",
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }
                if (finalLng !== null && (isNaN(finalLng) || finalLng < -180 || finalLng > 180)) {
                    results.detailedLog.errors.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: "Location validation",
                        reason: "Longitude must be a number between -180 and 180",
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }

                // Check for existing agent
                let existingAgent = await Agent.findOne({ where: { phone }, transaction });
                if (!existingAgent && email) {
                    existingAgent = await Agent.findOne({ where: { email }, transaction });
                }

                let agentResult;
                if (existingAgent) {
                    // Update existing agent
                    agentResult = await this.updateAgent(
                        existingAgent.agentID,
                        {
                            name,
                            lastname,
                            email,
                            phone,
                            supervisorID: supervisor.userID,
                            delegationID: delegationRecord.delegationID,
                            latitude: finalLat,
                            longitude: finalLng,
                            locationAddress: address,
                            actorID,
                        },
                        { transaction }
                    );

                    if (agentResult.success) {
                        results.detailedLog.updated.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            details: `Agent updated with email '${email}', assigned to delegation '${delegation}' and supervisor ${supervisor_phone}`,
                        });
                        results.summary.agentsUpdated++;
                    } else {
                        results.detailedLog.errors.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            operation: "Agent update",
                            reason: `Failed to update agent: ${agentResult.message}`,
                        });
                        results.summary.errorsEncountered++;
                        await transaction.rollback();
                        continue;
                    }
                } else {
                    // Create new agent
                    agentResult = await this.createAgent(
                        {
                            name,
                            lastname,
                            email,
                            phone,
                            supervisorID: supervisor.userID,
                            delegationID: delegationRecord.delegationID,
                            latitude: finalLat,
                            longitude: finalLng,
                            locationAddress: address,
                            actorID,
                        },
                        { transaction }
                    );

                    if (agentResult.success) {
                        results.detailedLog.created.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            details: `Agent created with email '${email}', assigned to delegation '${delegation}' and supervisor ${supervisor_phone}`,
                        });
                        results.summary.agentsCreated++;
                    } else {
                        results.detailedLog.errors.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            operation: "Agent creation",
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
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: "Supervisor assignment",
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
                    agentPhone: phone || "N/A",
                    agentName: `${name || ""} ${lastname || ""}`.trim() || "Unnamed",
                    timestamp: new Date().toISOString(),
                    operation: "Record processing",
                    reason: `Unexpected error occurred: ${error.message}`,
                });
                results.summary.errorsEncountered++;
            }
        }

        // Determine overall status
        results.status =
            results.summary.errorsEncountered === 0 && results.summary.recordsSkipped === 0
                ? "completed_successfully"
                : results.summary.agentsCreated > 0 || results.summary.agentsUpdated > 0
                    ? "completed_with_issues"
                    : "failed";

        return results;
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
     * @param {Buffer} fileBuffer - Uploaded CSV file buffer.
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

        // Extract CSV headers
        const firstLine = bufferString.split('\n')[0].trim();
        if (!firstLine) {
            results.detailedLog.errors.push({
                agentPhone: 'N/A',
                agentName: 'N/A',
                timestamp: new Date().toISOString(),
                operation: 'CSV parsing',
                reason: 'CSV file is empty or has no headers',
            });
            results.summary.errorsEncountered++;
            return results;
        }
        const csvHeaders = firstLine.split(',').map(h => h.trim()).filter(h => h);

        // Validate mandatory headers
        const mandatoryCsvHeaders = MANDATORY_HEADERS.map(h => h.csvHeader);
        const missingMandatory = mandatoryCsvHeaders.filter(h => !csvHeaders.includes(h));
        if (missingMandatory.length > 0) {
            results.detailedLog.errors.push({
                agentPhone: 'N/A',
                agentName: 'N/A',
                timestamp: new Date().toISOString(),
                operation: 'Header validation',
                reason: `Missing required headers: ${missingMandatory.join(', ')}`,
            });
            results.summary.errorsEncountered++;
            return results;
        }

        // Validate header mappings
        const mappedHeaders = headerMappings.map(h => h.mappedHeader);
        const unmappedMandatory = mandatoryCsvHeaders.filter(h => !mappedHeaders.includes(h));
        if (unmappedMandatory.length > 0) {
            results.detailedLog.errors.push({
                agentPhone: 'N/A',
                agentName: 'N/A',
                timestamp: new Date().toISOString(),
                operation: 'Header mapping',
                reason: `Required headers not mapped: ${unmappedMandatory.join(', ')}`,
            });
            results.summary.errorsEncountered++;
            return results;
        }

        // Parse CSV with dynamic column mapping
        const parser = Readable.from(bufferString).pipe(
            csv.parse({
                columns: header => header.map(h => headerMap[h] || h),
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
                name,
                lastname,
                email,
                phone,
                delegation: delegationName,
                supervisor_phone: supervisorPhone,
                governorate,
                adress: address,
                lat: latitude,
                lng: longitude,
            } = record;

            // Validate required fields
            if (!name || !lastname || !email || !phone || !delegationName || !supervisorPhone) {
                results.detailedLog.skipped.push({
                    agentPhone: phone || 'N/A',
                    agentName: `${name || ''} ${lastname || ''}`.trim() || 'Unnamed',
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
                    where: { phone: supervisorPhone },
                    include: [
                        { model: Role, through: { attributes: [] }, attributes: ['name'] },
                        { model: Delegation, through: { attributes: [] } },
                    ],
                    transaction,
                });

                if (!supervisor || !supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                    results.detailedLog.skipped.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        reason: `No valid supervisor found with phone number ${supervisorPhone}`,
                    });
                    results.summary.recordsSkipped++;
                    await transaction.rollback();
                    continue;
                }

                // Prevent self-supervision
                if (phone === supervisorPhone) {
                    results.detailedLog.skipped.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
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
                            [Op.iLike]: delegationName,
                        },
                    },
                    transaction,
                });
                if (!delegationRecord) {
                    results.detailedLog.errors.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: 'Delegation lookup',
                        reason: `Delegation '${delegationName}' not found in the system`,
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }

                // Validate governorate if provided
                if (governorate) {
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
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            operation: 'Governorate lookup',
                            reason: `Governorate '${governorate}' not found in the system`,
                        });
                        results.summary.errorsEncountered++;
                        await transaction.rollback();
                        continue;
                    }

                    // Check if delegation belongs to governorate
                    if (delegationRecord.governorateID !== governorateRecord.governorateID) {
                        results.detailedLog.errors.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            operation: 'Governorate validation',
                            reason: `Delegation '${delegationName}' does not belong to governorate '${governorate}'`,
                        });
                        results.summary.errorsEncountered++;
                        await transaction.rollback();
                        continue;
                    }
                }

                // Assign governorate to supervisor if provided
                if (governorate) {
                    const governorateRecord = await Governorate.findOne({
                        where: { name: { [Op.iLike]: governorate } },
                        transaction,
                    });
                    if (governorateRecord) {
                        const governorateAssignment = await UserService.assignGovernorateToUser(
                            supervisor.userID,
                            governorateRecord.governorateID,
                            actorID,
                            { transaction }
                        );
                        if (!governorateAssignment.success) {
                            results.detailedLog.errors.push({
                                agentPhone: phone,
                                agentName: `${name} ${lastname}`,
                                timestamp: new Date().toISOString(),
                                operation: 'Governorate assignment',
                                reason: `Failed to assign governorate '${governorate}' to supervisor ${supervisorPhone}: ${governorateAssignment.message}`,
                            });
                            results.summary.errorsEncountered++;
                            await transaction.rollback();
                            continue;
                        }
                    }
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
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: 'Delegation assignment',
                        reason: `Failed to assign delegation '${delegationName}' to supervisor ${supervisorPhone}: ${delegationAssignment.message}`,
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }

                // Handle location data
                let finalLat = latitude ? parseFloat(latitude) : null;
                let finalLng = longitude ? parseFloat(longitude) : null;
                if (address && !latitude && !longitude) {
                    try {
                        const geocode = await GoogleMapsService.geocodeAddress(address);
                        finalLat = geocode.latitude;
                        finalLng = geocode.longitude;
                    } catch (error) {
                        results.detailedLog.errors.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            operation: 'Geocoding',
                            reason: `Failed to geocode address '${address}': ${error.message}`,
                        });
                        results.summary.errorsEncountered++;
                        await transaction.rollback();
                        continue;
                    }
                }

                // Validate location data
                if (finalLat !== null && (isNaN(finalLat) || finalLat < -90 || finalLat > 90)) {
                    results.detailedLog.errors.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: 'Location validation',
                        reason: 'Latitude must be a number between -90 and 90',
                    });
                    results.summary.errorsEncountered++;
                    await transaction.rollback();
                    continue;
                }
                if (finalLng !== null && (isNaN(finalLng) || finalLng < -180 || finalLng > 180)) {
                    results.detailedLog.errors.push({
                        agentPhone: phone,
                        agentName: `${name} ${lastname}`,
                        timestamp: new Date().toISOString(),
                        operation: 'Location validation',
                        reason: 'Longitude must be a number between -180 and 180',
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
                        name,
                        lastname,
                        email,
                        phone,
                        supervisorID: supervisor.userID,
                        delegationID: delegationRecord.delegationID,
                        latitude: finalLat,
                        longitude: finalLng,
                        locationAddress: address,
                        actorID,
                    }, { transaction });

                    if (agentResult.success) {
                        results.detailedLog.updated.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            details: `Agent updated with email '${email}', assigned to delegation '${delegationName}' and supervisor ${supervisorPhone}`,
                        });
                        results.summary.agentsUpdated++;
                    } else {
                        results.detailedLog.errors.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
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
                        name,
                        lastname,
                        email,
                        phone,
                        supervisorID: supervisor.userID,
                        delegationID: delegationRecord.delegationID,
                        latitude: finalLat,
                        longitude: finalLng,
                        locationAddress: address,
                        actorID,
                    }, { transaction });

                    if (agentResult.success) {
                        results.detailedLog.created.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
                            timestamp: new Date().toISOString(),
                            details: `Agent created with email '${email}', assigned to delegation '${delegationName}' and supervisor ${supervisorPhone}`,
                        });
                        results.summary.agentsCreated++;
                    } else {
                        results.detailedLog.errors.push({
                            agentPhone: phone,
                            agentName: `${name} ${lastname}`,
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
                        agentName: `${name} ${lastname}`,
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
                    agentName: `${name || ''} ${lastname || ''}`.trim() || 'Unnamed',
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




    static async getAgentsByBounds({ southWestLat, southWestLng, northEastLat, northEastLng }) {
        try {
            const agents = await Agent.findAll({
                where: {
                    latitude: { [Op.between]: [southWestLat, northEastLat] },
                    longitude: { [Op.between]: [southWestLng, northEastLng] },
                },
                include: [
                    { model: User, as: 'Supervisor', attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'] },
                    { model: Delegation, attributes: ['delegationID', 'name'], include: [{ model: Governorate, attributes: ['governorateID', 'name'] }] },
                ],
            });
            return agents || [];
        } catch (error) {
            return [];
        }
    }


}

module.exports = AgentService;