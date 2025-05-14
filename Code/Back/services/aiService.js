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
         * Normalize time string to 12-hour AM/PM format.
         * @param {string} time - Time string (e.g., "14:00", "14:00 PM", "2:00 PM").
         * @returns {string} Normalized time in "HH:MM AM/PM" format (e.g., "2:00 PM").
         * @throws {Error} If the time format is invalid.
         */
    static normalizeTimeFormat(time) {
        if (!time || typeof time !== 'string') {
            throw new Error('Invalid time format: Time must be a non-empty string');
        }

        const time24Hour = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
        const time12Hour = /^([0]?[1-9]|1[0-2]):([0-5][0-9]) (AM|PM)$/i;
        const invalidMix = /^([0-9]{1,2}):([0-5][0-9]) (AM|PM)$/i;

        if (time12Hour.test(time)) {
            return time.toUpperCase();
        }

        if (invalidMix.test(time)) {
            const [, hours, minutes, period] = time.match(invalidMix);
            const hourNum = parseInt(hours, 10);
            if (hourNum < 1 || hourNum > 23) {
                throw new Error(`Invalid time format: ${time}. Hours must be between 1 and 23 for 24-hour conversion`);
            }
            const normalized = this.convert24HourTo12Hour(hourNum, parseInt(minutes, 10));
            logger.warn(`Corrected invalid time format: ${time} -> ${normalized}`, { service: 'ai' });
            return normalized;
        }

        if (time24Hour.test(time)) {
            const [hours, minutes] = time.split(':').map(Number);
            return this.convert24HourTo12Hour(hours, minutes);
        }

        throw new Error(`Invalid time format: ${time}`);
    }

    /**
     * Convert 24-hour time to 12-hour AM/PM format.
     * @param {number} hours - Hours in 24-hour format (0-23).
     * @param {number} minutes - Minutes (0-59).
     * @returns {string} Time in 12-hour AM/PM format (e.g., "2:00 PM").
     */
    static convert24HourTo12Hour(hours, minutes) {
        const period = hours >= 12 ? 'PM' : 'AM';
        const adjustedHours = hours % 12 || 12;
        return `${adjustedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    static async generateTimesheetSuggestions({ supervisorId, weekNumber, year, criteria }) {
        const weekStartString = new Date(year, 0, 1 + (weekNumber - 1) * 7).toLocaleDateString('en-GB');
        const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(year, 0, 1 + (weekNumber - 1) * 7 + i);
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        });

        const agents = await Agent.findAll({
            where: { supervisorID: supervisorId },
            attributes: ['agentID', 'name', 'latitude', 'longitude'],
        });
        const agentData = agents.map(agent => ({
            id: agent.agentID,
            name: agent.name,
            latitude: agent.latitude,
            longitude: agent.longitude,
        }));

        const reasons = await Reason.findAll({
            attributes: ['reasonID', 'item'],
        });
        const checklists = await Checklist.findAll({
            attributes: ['checklistID', 'item'],
        });

        const supervisor = await User.findByPk(supervisorId, {
            attributes: ['latitude', 'longitude'],
        });
        const supervisorLocation = {
            latitude: supervisor?.latitude || 0,
            longitude: supervisor?.longitude || 0,
        };

        const timeInterval = {
            startHour: 8,
            endHour: 18,
        };
        const maxVisitsPerAgentPerWeek = config.maxVisitsPerAgentPerWeek || 10;

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
          "startTime": "string (HH:MM AM/PM, e.g., 2:00 PM, using 12-hour clock where hours are 1-12)",
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
If a reason has no specific checklist mapping, select relevant checklists from the provided list. Allow multiple reasons and checklists per visit. Ensure visit start times are within the specified time interval (${timeInterval.startHour}:00 to ${timeInterval.endHour}:00) and formatted strictly as 12-hour clock times (e.g., "2:00 PM", not "14:00" or "14:00 PM"). Limit each agent to a maximum of ${maxVisitsPerAgentPerWeek} visits per week. If insufficient data (e.g., no agents, reasons, or checklists) is provided, return an empty JSON array []. Do not include any explanatory text or examples; return only the JSON array of suggestions.`;

        let suggestions;
        try {
            const response = await OllamaClient.generate({
                model: config.ollamaModel,
                prompt,
                format: 'json',
            });
            suggestions = JSON.parse(response);
        } catch (error) {
            logger.error('Failed to generate timesheet suggestions', {
                error: error.message,
                service: 'ai',
                metadata: { supervisorId, weekNumber, year },
            });
            return [];
        }

        if (!Array.isArray(suggestions)) {
            logger.warn('Invalid suggestions format, expected array', {
                service: 'ai',
                metadata: { supervisorId, weekNumber, year, suggestions },
            });
            return [];
        }

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
                                let normalizedStartTime;
                                try {
                                    normalizedStartTime = this.normalizeTimeFormat(visit.startTime);
                                } catch (error) {
                                    logger.warn(`Skipping visit with invalid time format: ${visit.startTime}`, {
                                        service: 'ai',
                                        metadata: { supervisorId, weekNumber, year, visit },
                                    });
                                    return null;
                                }

                                const transformedReasons = Array.isArray(visit.reasons)
                                    ? visit.reasons.map(reason => {
                                        if (typeof reason === 'string' && reasonMap[reason]) {
                                            return reasonMap[reason];
                                        }
                                        return reason;
                                    }).filter(r => r && r.id && r.item)
                                    : [];

                                const transformedChecklists = Array.isArray(visit.checklists)
                                    ? visit.checklists.map(checklist => {
                                        if (typeof checklist === 'string' && checklistMap[checklist]) {
                                            return checklistMap[checklist];
                                        }
                                        return checklist;
                                    }).filter(c => c && c.id && c.item)
                                    : [];

                                return {
                                    startTime: normalizedStartTime,
                                    location: visit.location,
                                    latitude: visit.latitude,
                                    longitude: visit.longitude,
                                    reasons: transformedReasons,
                                    checklists: transformedChecklists,
                                };
                            })
                            .filter(visit => visit && visit.reasons.length > 0 && visit.checklists.length > 0),
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