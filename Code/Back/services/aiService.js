const { makeOllamaApiCall } = require('../utils/apiClient');
const logger = require('../utils/logger');
const { initializeAI } = require('../config/ai');
const { AIConfig, User, Agent, Reason, Checklist, Delegation } = require('../models');
const { Op } = require('sequelize');

const ERROR_MESSAGES = {
    INVALID_SUPERVISOR: 'Invalid supervisor ID.',
    INVALID_WEEK_NUMBER: 'Invalid week number or year.',
    INVALID_DELEGATIONS: 'Invalid delegation IDs provided.',
    INVALID_AGENTS: 'Invalid agent IDs provided.',
    INVALID_DATA_TYPE: 'Invalid data type provided.',
    INVALID_FILTERS: 'Invalid report filters provided.',
    INVALID_FORMAT: 'Invalid report format. Use "pdf" or "excel".',
    AI_API_UNAVAILABLE: 'AI service is unavailable. Try again later.',
    INVALID_AI_RESPONSE: 'Invalid response from AI service.',
    NO_AGENTS_PROVIDED: 'No agents available for timesheet suggestions.',
    INVALID_TIME_INTERVAL: 'Invalid time interval provided.',
};

/**
 * Service for handling AI-related operations.
 */
class AIService {
    /**
     * Calculate the start date of a given ISO week number and year.
     * @param {number} weekNumber - ISO week number (1-53).
     * @param {number} year - Year (e.g., 2025).
     * @returns {Date} Start date of the week (Monday).
     */
    static getWeekStartDate(weekNumber, year) {
        // Validate inputs
        if (!weekNumber || weekNumber < 1 || weekNumber > 53 || !year || year < 2000 || year > 2100) {
            const error = new Error(ERROR_MESSAGES.INVALID_WEEK_NUMBER);
            error.status = 400;
            throw error;
        }

        // Create a date for January 4th of the given year (a reliable date in week 1)
        const jan4 = new Date(Date.UTC(year, 0, 4));
        // Adjust to the first Monday of the year
        const dayOfWeek = jan4.getUTCDay() || 7; // Convert Sunday (0) to 7
        const firstMonday = new Date(Date.UTC(year, 0, 4 - (dayOfWeek - 1)));

        // Calculate the start of the desired week
        const weekStart = new Date(firstMonday);
        weekStart.setUTCDate(firstMonday.getUTCDate() + (weekNumber - 1) * 7);

        return weekStart;
    }

    /**
     * Convert a day offset to a date string (DD/MM/YYYY).
     * @param {Date} weekStart - Week start date (Monday).
     * @param {number} dayOffset - Day offset (0 for Monday, 1 for Tuesday, etc.).
     * @returns {string} Date string in DD/MM/YYYY format.
     */
    static getDateString(weekStart, dayOffset) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    }

    /**
     * Calculate Haversine distance between two points in kilometers.
     * @param {number} lat1 - Latitude of first point.
     * @param {number} lon1 - Longitude of first point.
     * @param {number} lat2 - Latitude of second point.
     * @param {number} lon2 - Longitude of second point.
     * @returns {number} Distance in kilometers.
     */
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Generate timesheet suggestions using the AI model.
     * @param {string} supervisorId - The supervisor's user ID.
     * @param {number} weekNumber - The ISO week number (1-53).
     * @param {number} year - The year (e.g., 2025).
     * @param {Object} timesheetData - Data including delegation IDs, agent IDs, criteria, preferred days, time interval, and max visits.
     * @returns {Promise<Array>} List of timesheet suggestions.
     */
    static async generateTimesheetSuggestions(supervisorId, weekNumber, year, timesheetData) {
        try {
            // Validate supervisor
            const supervisor = await User.findByPk(supervisorId);
            if (!supervisor) {
                const error = new Error(ERROR_MESSAGES.INVALID_SUPERVISOR);
                error.status = 404;
                throw error;
            }

            // Validate weekNumber and year (already validated in getWeekStartDate)
            const weekStart = this.getWeekStartDate(weekNumber, year);
            const weekStartString = weekStart.toISOString().split('T')[0];

            // Extract timesheet data
            const {
                delegationIds = [],
                agentIds = [],
                criteria = {},
                preferredDays = [],
                timeInterval = { startHour: 8, endHour: 20 },
                maxVisitsPerAgentPerWeek = 1,
            } = timesheetData;

            // Validate time interval
            if (
                !Number.isInteger(timeInterval.startHour) ||
                !Number.isInteger(timeInterval.endHour) ||
                timeInterval.startHour < 0 ||
                timeInterval.endHour > 24 ||
                timeInterval.startHour >= timeInterval.endHour
            ) {
                const error = new Error(ERROR_MESSAGES.INVALID_TIME_INTERVAL);
                error.status = 400;
                throw error;
            }

            // Validate delegation IDs
            if (delegationIds.length > 0) {
                const delegations = await Delegation.findAll({
                    where: { delegationID: { [Op.in]: delegationIds } },
                });
                if (delegations.length !== delegationIds.length) {
                    const error = new Error(ERROR_MESSAGES.INVALID_DELEGATIONS);
                    error.status = 400;
                    throw error;
                }
            }

            // Fetch agents based on agent IDs, delegation IDs, or all agents under supervisor
            const agentQuery = {
                where: { supervisorID: supervisorId },
                include: [{ model: Delegation }],
            };
            if (agentIds.length > 0) {
                agentQuery.where.agentID = { [Op.in]: agentIds };
            }
            if (delegationIds.length > 0) {
                agentQuery.where.delegationID = { [Op.in]: delegationIds };
            }
            const agents = await Agent.findAll(agentQuery);
            const agentData = agents.map(agent => ({
                agentID: agent.agentID,
                name: agent.name,
                lastname: agent.lastname,
                location: agent.location,
                latitude: agent.latitude,
                longitude: agent.longitude,
                delegation: agent.Delegation?.name || 'Unknown',
                weeklyTarget: agent.weeklyTarget || 0,
            }));

            // Validate that agents exist
            if (agentData.length === 0) {
                logger.warn('No agents found for timesheet suggestions', {
                    service: 'ai',
                    metadata: { supervisorId, weekNumber, year },
                });
                return [];
            }

            // Validate agent IDs
            if (agentIds.length > 0 && agentData.length !== agentIds.length) {
                const error = new Error(ERROR_MESSAGES.INVALID_AGENTS);
                error.status = 400;
                throw error;
            }

            // Fetch reasons and checklists from database
            const reasons = await Reason.findAll();
            const checklists = await Checklist.findAll();

            // Create lookup maps for reasons and checklists
            const reasonMap = {};
            reasons.forEach(r => {
                reasonMap[r.reasonID] = { id: r.reasonID, item: r.item };
            });
            const checklistMap = {};
            checklists.forEach(c => {
                checklistMap[c.checklistID] = { id: c.checklistID, item: c.item };
            });

            // Define reason-to-checklist mapping
            const reasonChecklistMapping = {
                'Routine Inspection': ['Safety Checklist', 'Equipment Checklist'],
                'Maintenance': ['Maintenance Checklist', 'Inventory Checklist'],
                'Training': ['Training Checklist'],
                'Audit': ['Audit Checklist', 'Compliance Checklist'],
                'Customer complaint': ['Test security cameras', 'Review employee attendance'],
            };

            // Determine days for visits (use preferredDays or all 7 days)
            const daysOfWeek = preferredDays.length > 0
                ? preferredDays.map((day, index) => this.getDateString(weekStart, index))
                : Array.from({ length: 7 }, (_, i) => this.getDateString(weekStart, i));

            // Get supervisor's location
            const supervisorLocation = timesheetData.supervisorLocation || { latitude: 36.8065, longitude: 10.1815 };

            const aiConfig = await initializeAI();
            const config = (await AIConfig.findOne({ where: { supervisorId } })) || aiConfig;
            const prompt = `Generate up to ${config.timesheetMaxSuggestions} timesheet suggestions for supervisor ${supervisorId} for the week ${weekNumber} of ${year} starting on ${weekStartString}. Each suggestion assigns visits to agents, respecting the criteria: ${JSON.stringify(criteria)}. Optimize based on agent locations, delegation assignments, and weekly targets. Use the following data:
- Agents: ${JSON.stringify(agentData)}
- Reasons: ${JSON.stringify(reasons.map(r => ({ id: r.reasonID, item: r.item })))}
- Checklists: ${JSON.stringify(checklists.map(c => ({ id: c.checklistID, item: c.item })))}
- Dates: ${JSON.stringify(daysOfWeek)}
- Supervisor Location: ${JSON.stringify(supervisorLocation)}
- Time Interval: ${JSON.stringify(timeInterval)}
- Max Visits Per Agent Per Week: ${maxVisitsPerAgentPerWeek}

Return the response as a JSON array of objects, where each object has the following structure:
{
  "agentID": "string",
  "schedule": [
    {
      "date": "string (DD/MM/YYYY, e.g., 20/05/2025)",
      "visits": [
        {
          "startTime": "string (HH:MM AM/PM)",
          "location": "string",
          "latitude": "number",
          "longitude": "number",
          "reasons": [{"id": "string", "item": "string"}],
          "checklists": [{"id": "string", "item": "string"}]
        }
      ]
    }
  ]
}

For each date, sort visits by distance from the supervisor's location (${supervisorLocation.latitude}, ${supervisorLocation.longitude}), then by proximity to the previous visit. Use the Haversine formula for distance calculations. Ensure reasons and checklists are selected from the provided lists. Assign checklists based on the reasons selected, using the following mapping:
${JSON.stringify(reasonChecklistMapping)}
If a reason has no specific checklist mapping, select relevant checklists from the provided list. Allow multiple reasons and checklists per visit. Ensure visit start times are within the specified time interval (${timeInterval.startHour}:00 to ${timeInterval.endHour}:00). Limit each agent to a maximum of ${maxVisitsPerAgentPerWeek} visits per week. If insufficient data (e.g., no agents, reasons, or checklists) is provided, return an empty JSON array []. Do not include any explanatory text or examples; return only the JSON array of suggestions.`;

            const payload = {
                model: config.modelName,
                prompt,
                stream: false,
            };

            logger.info('Sending request to Ollama API', {
                service: 'ai',
                metadata: { supervisorId, weekNumber, year, payload },
            });

            const response = await makeOllamaApiCall('post', '/generate', payload);

            logger.debug('Ollama API response', {
                service: 'ai',
                metadata: { supervisorId, weekNumber, year, response },
            });

            // Validate response
            if (!response || !response.response) {
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            // Parse the response
            let suggestions;
            try {
                suggestions = JSON.parse(response.response);
            } catch (parseError) {
                logger.error('Failed to parse AI response as JSON', {
                    error: parseError.message,
                    service: 'ai',
                    metadata: { supervisorId, weekNumber, year, response: response.response },
                });
                return [];
            }

            // Handle case where response is wrapped in { suggestions: [...] }
            if (!Array.isArray(suggestions) && suggestions.suggestions && Array.isArray(suggestions.suggestions)) {
                suggestions = suggestions.suggestions;
            }

            // Validate suggestions
            if (!Array.isArray(suggestions)) {
                logger.error('AI response is not an array', {
                    service: 'ai',
                    metadata: { supervisorId, weekNumber, year, suggestions },
                });
                return [];
            }

            // Transform suggestions to ensure reasons and checklists are objects
            const transformedSuggestions = suggestions.map(suggestion => {
                if (!suggestion.agentID || !Array.isArray(suggestion.schedule)) {
                    logger.warn('Invalid suggestion structure, skipping', {
                        service: 'ai',
                        metadata: { supervisorId, weekNumber, year, suggestion },
                    });
                    return null;
                }
                return {
                    agentID: suggestion.agentID,
                    schedule: suggestion.schedule.map(day => {
                        if (!day.date || !Array.isArray(day.visits)) {
                            logger.warn('Invalid schedule structure, skipping day', {
                                service: 'ai',
                                metadata: { supervisorId, weekNumber, year, day },
                            });
                            return null;
                        }
                        return {
                            date: day.date,
                            visits: day.visits
                                .map(visit => {
                                    // Transform reasons (strings to objects)
                                    const transformedReasons = Array.isArray(visit.reasons)
                                        ? visit.reasons.map(reason => {
                                            if (typeof reason === 'string' && reasonMap[reason]) {
                                                return reasonMap[reason];
                                            }
                                            return reason; // Already an object or invalid
                                        }).filter(r => r && r.id && r.item)
                                        : [];

                                    // Transform checklists (strings to objects)
                                    const transformedChecklists = Array.isArray(visit.checklists)
                                        ? visit.checklists.map(checklist => {
                                            if (typeof checklist === 'string' && checklistMap[checklist]) {
                                                return checklistMap[checklist];
                                            }
                                            return checklist; // Already an object or invalid
                                        }).filter(c => c && c.id && c.item)
                                        : [];

                                    return {
                                        startTime: visit.startTime,
                                        location: visit.location,
                                        latitude: visit.latitude,
                                        longitude: visit.longitude,
                                        reasons: transformedReasons,
                                        checklists: transformedChecklists,
                                    };
                                })
                                .sort((a, b) => {
                                    const distA = this.calculateDistance(
                                        supervisorLocation.latitude,
                                        supervisorLocation.longitude,
                                        a.latitude || supervisorLocation.latitude,
                                        a.longitude || supervisorLocation.longitude
                                    );
                                    const distB = this.calculateDistance(
                                        supervisorLocation.latitude,
                                        supervisorLocation.longitude,
                                        b.latitude || supervisorLocation.latitude,
                                        b.longitude || supervisorLocation.longitude
                                    );
                                    return distA - distB;
                                })
                                .filter(visit => visit.reasons.length > 0 && visit.checklists.length > 0),
                        };
                    }).filter(day => day && day.visits.length > 0),
                };
            }).filter(suggestion => suggestion && suggestion.schedule.length > 0);

            logger.info('Timesheet suggestions generated', {
                service: 'ai',
                metadata: { supervisorId, weekNumber, year, suggestionCount: transformedSuggestions.length },
            });
            logger.debug('Final transformed suggestions', {
                service: 'ai',
                metadata: { supervisorId, weekNumber, year, suggestions: transformedSuggestions },
            });

            return transformedSuggestions;
        } catch (error) {
            logger.error('Failed to generate timesheet suggestions', {
                error: error.message,
                stack: error.stack,
                service: 'ai',
                metadata: { supervisorId, weekNumber, year },
            });
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503 });
        }
    }

    /**
     * Detect anomalies in the provided data using the AI model.
     * @param {string} dataType - Type of data (e.g., timesheet, visit).
     * @param {Array} data - Data to analyze.
     * @returns {Promise<Array>} List of detected anomalies.
     */
    static async detectAnomalies(dataType, data) {
        try {
            const validDataTypes = ['timesheet', 'visit', 'receipt'];
            if (!dataType || !validDataTypes.includes(dataType)) {
                const error = new Error(ERROR_MESSAGES.INVALID_DATA_TYPE);
                error.status = 400;
                throw error;
            }

            if (!Array.isArray(data) || data.length === 0) {
                const error = new Error('Data must be a non-empty array');
                error.status = 400;
                throw error;
            }

            const aiConfig = await initializeAI();
            const config = (await AIConfig.findOne()) || aiConfig;
            const prompt = `Analyze ${dataType} data: ${JSON.stringify(data)}. Detect anomalies with a confidence threshold of ${config.anomalyThreshold}. Return a JSON array of anomalies with explanations.`;

            const payload = {
                model: config.modelName,
                prompt,
                stream: false,
            };

            const response = await makeOllamaApiCall('post', '/generate', payload);

            if (!response || !response.response) {
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            let anomalies;
            try {
                anomalies = JSON.parse(response.response);
            } catch (parseError) {
                logger.error('Failed to parse anomaly response', {
                    error: parseError.message,
                    service: 'ai',
                    metadata: { dataType, response: response.response },
                });
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            if (!Array.isArray(anomalies)) {
                logger.error('Anomaly response is not an array', {
                    service: 'ai',
                    metadata: { dataType, anomalies },
                });
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            logger.info('Anomalies detected', {
                service: 'ai',
                metadata: { dataType, anomalyCount: anomalies.length },
            });

            return anomalies;
        } catch (error) {
            logger.error('Failed to detect anomalies', {
                error: error.message,
                stack: error.stack,
                service: 'ai',
                metadata: { dataType },
            });
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503 });
        }
    }

    /**
     * Generate a report using the AI model.
     * @param {Object} filters - Filters for the report (e.g., date range, regions).
     * @param {string} format - Report format (pdf or excel).
     * @returns {Promise<Object>} Generated report data.
     */
    static async generateReport(filters, format) {
        try {
            if (!filters || typeof filters !== 'object') {
                const error = new Error(ERROR_MESSAGES.INVALID_FILTERS);
                error.status = 400;
                throw error;
            }

            const validFormats = ['pdf', 'excel'];
            if (!format || !validFormats.includes(format)) {
                const error = new Error(ERROR_MESSAGES.INVALID_FORMAT);
                error.status = 400;
                throw error;
            }

            const aiConfig = await initializeAI();
            const prompt = `Generate a ${format} report based on filters: ${JSON.stringify(filters)}. Include summaries and visualizations where applicable. Return the response as a JSON object.`;

            const payload = {
                model: aiConfig.modelName,
                prompt,
                stream: false,
            };

            const response = await makeOllamaApiCall('post', '/generate', payload);

            if (!response || !response.response) {
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            let report;
            try {
                report = JSON.parse(response.response);
            } catch (parseError) {
                logger.error('Failed to parse report response', {
                    error: parseError.message,
                    service: 'ai',
                    metadata: { format, response: response.response },
                });
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            logger.info('Report generated', {
                service: 'ai',
                metadata: { format },
            });

            return report;
        } catch (error) {
            logger.error('Failed to generate report', {
                error: error.message,
                stack: error.stack,
                service: 'ai',
                metadata: { format },
            });
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503 });
        }
    }
}

module.exports = AIService;