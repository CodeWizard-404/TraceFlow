// aiService.js
const { makeOllamaApiCall } = require('../utils/apiClient');
const logger = require('../utils/logger');
const { initializeAI } = require('../config/ai');
const { AIConfig, User, Agent, Reason, Checklist, Delegation } = require('../models');
const { Op } = require('sequelize');
const NodeCache = require('node-cache');
const JSONStream = require('JSONStream');

// Initialize cache with 1-hour TTL
const cache = new NodeCache({ stdTTL: 3600 });

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
    REQUEST_CANCELED: 'AI request was canceled.',
};

class AIService {
    /**
     * Calculate the start date of a given ISO week number and year.
     * @param {number} weekNumber - ISO week number (1-53).
     * @param {number} year - Year (e.g., 2025).
     * @returns {Date} Start date of the week (Monday).
     */
    static getWeekStartDate(weekNumber, year) {
        if (!weekNumber || weekNumber < 1 || weekNumber > 53 || !year || year < 2000 || year > 2100) {
            const error = new Error(ERROR_MESSAGES.INVALID_WEEK_NUMBER);
            error.status = 400;
            throw error;
        }
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const dayOfWeek = jan4.getUTCDay() || 7;
        const firstMonday = new Date(Date.UTC(year, 0, 4 - (dayOfWeek - 1)));
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
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Get cached reasons.
     * @returns {Promise<Array>} Cached or fetched reasons.
     */
    static async getCachedReasons() {
        let reasons = cache.get('reasons');
        if (!reasons) {
            reasons = await Reason.findAll({ attributes: ['reasonID', 'item'] });
            cache.set('reasons', reasons);
        }
        return reasons;
    }

    /**
     * Get cached checklists.
     * @returns {Promise<Array>} Cached or fetched checklists.
     */
    static async getCachedChecklists() {
        let checklists = cache.get('checklists');
        if (!checklists) {
            checklists = await Checklist.findAll({ attributes: ['checklistID', 'item'] });
            cache.set('checklists', checklists);
        }
        return checklists;
    }

    /**
     * Generate timesheet suggestions using the AI model.
     * @param {string} supervisorId - The supervisor's user ID.
     * @param {number} weekNumber - The ISO week number (1-53).
     * @param {number} year - The year (e.g., 2025).
     * @param {Object} timesheetData - Data including delegation IDs, agent IDs, criteria, preferred days, time interval, and max visits.
     * @param {AbortController} [controller] - Optional AbortController to cancel the request.
     * @returns {Promise<Array>} List of timesheet suggestions.
     */
    static async generateTimesheetSuggestions(supervisorId, weekNumber, year, timesheetData, controller = new AbortController()) {
        try {
            // Validate supervisor
            const supervisor = await User.findByPk(supervisorId, { attributes: ['userID'] });
            if (!supervisor) {
                const error = new Error(ERROR_MESSAGES.INVALID_SUPERVISOR);
                error.status = 404;
                throw error;
            }

            // Validate weekNumber and year
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
                supervisorLocation = { latitude: 36.8065, longitude: 10.1815 }
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
                    attributes: ['delegationID']
                });
                if (delegations.length !== delegationIds.length) {
                    const error = new Error(ERROR_MESSAGES.INVALID_DELEGATIONS);
                    error.status = 400;
                    throw error;
                }
            }

            // Fetch data in parallel
            const [agents, reasons, checklists] = await Promise.all([
                Agent.findAll({
                    where: {
                        supervisorID: supervisorId,
                        ...(agentIds.length > 0 && { agentID: { [Op.in]: agentIds } }),
                        ...(delegationIds.length > 0 && { delegationID: { [Op.in]: delegationIds } })
                    },
                    attributes: ['agentID', 'name', 'lastname', 'location', 'latitude', 'longitude', 'delegationID'],
                    include: [{ model: Delegation, attributes: ['name'] }]
                }),
                this.getCachedReasons(),
                this.getCachedChecklists()
            ]);

            // Pre-filter agents by distance (rule-based filtering, max 50km)
            const filteredAgents = agents.filter(agent =>
                this.calculateDistance(
                    supervisorLocation.latitude,
                    supervisorLocation.longitude,
                    agent.latitude,
                    agent.longitude
                ) < 50
            );

            const agentData = filteredAgents.map(agent => ({
                agentID: agent.agentID,
                name: agent.name,
                lastname: agent.lastname,
                location: agent.location,
                latitude: agent.latitude,
                longitude: agent.longitude,
                delegation: agent.Delegation?.name || 'Unknown',
            }));

            if (agentData.length === 0) {
                logger.warn('No agents found for timesheet suggestions', {
                    service: 'ai',
                    metadata: { supervisorId, weekNumber, year }
                });
                return [];
            }

            // Validate agent IDs
            if (agentIds.length > 0 && agentData.length !== agentIds.length) {
                const error = new Error(ERROR_MESSAGES.INVALID_AGENTS);
                error.status = 400;
                throw error;
            }

            // Create lookup maps
            const reasonMap = {};
            reasons.forEach(r => { reasonMap[r.reasonID] = { id: r.reasonID, item: r.item }; });
            const checklistMap = {};
            checklists.forEach(c => { checklistMap[c.checklistID] = { id: c.checklistID, item: c.item }; });

            // Reason-to-checklist mapping
            const reasonChecklistMapping = {
                'Routine Inspection': ['Safety Checklist', 'Equipment Checklist'],
                'Maintenance': ['Maintenance Checklist', 'Inventory Checklist'],
                'Training': ['Training Checklist'],
                'Audit': ['Audit Checklist', 'Compliance Checklist'],
                'Customer complaint': ['Test security cameras', 'Review employee attendance']
            };

            // Determine days for visits
            const daysOfWeek = preferredDays.length > 0
                ? preferredDays.map((day, index) => this.getDateString(weekStart, index))
                : Array.from({ length: 7 }, (_, i) => this.getDateString(weekStart, i));

            // Precompute distances
            const distanceMap = {};
            agentData.forEach(agent => {
                distanceMap[agent.agentID] = this.calculateDistance(
                    supervisorLocation.latitude,
                    supervisorLocation.longitude,
                    agent.latitude,
                    agent.longitude
                );
            });

            // Check cache for AI response
            const cacheKey = `${supervisorId}-${weekNumber}-${year}-${JSON.stringify(timesheetData)}`;
            let suggestions = cache.get(cacheKey);
            if (suggestions) {
                logger.info('Returning cached timesheet suggestions', {
                    service: 'ai',
                    metadata: { supervisorId, weekNumber, year }
                });
                return suggestions;
            }

            const aiConfig = await initializeAI();
            const config = (await AIConfig.findOne({ where: { supervisorId }, attributes: ['modelName', 'timesheetMaxSuggestions'] })) || aiConfig;

            // Simplified prompt
            const prompt = `Generate up to ${config.timesheetMaxSuggestions} timesheet suggestions for supervisor ${supervisorId} for week ${weekNumber} of ${year} starting ${weekStartString}.
- Agents: ${agentData.map(a => `${a.agentID}:${a.latitude},${a.longitude}`).join(';')}
- Reasons: ${reasons.map(r => `${r.reasonID}:${r.item}`).join(';')}
- Checklists: ${checklists.map(c => `${c.checklistID}:${c.item}`).join(';')}
- Dates: ${daysOfWeek.join(',')}
- Supervisor Location: ${supervisorLocation.latitude},${supervisorLocation.longitude}
- Time Interval: ${timeInterval.startHour}:00-${timeInterval.endHour}:00
- Max Visits Per Agent: ${maxVisitsPerAgentPerWeek}
- Criteria: ${JSON.stringify(criteria)}
Return a JSON array of objects: [{"agentID":"string","schedule":[{"date":"DD/MM/YYYY","visits":[{"startTime":"HH:MM AM/PM","location":"string","latitude":number,"longitude":number,"reasons":[{"id":"string","item":"string"}],"checklists":[{"id":"string","item":"string"}]}]}]}]
Sort visits by distance from supervisor using Haversine formula. Assign checklists per reason: ${JSON.stringify(reasonChecklistMapping)}. Ensure times within interval. Return empty array if insufficient data.`;

            const payload = {
                model: config.modelName,
                prompt,
                stream: false
            };

            logger.info('Sending request to Ollama API', {
                service: 'ai',
                metadata: { supervisorId, weekNumber, year }
            });

            // Pass the AbortSignal to the API call
            const response = await makeOllamaApiCall('post', '/generate', payload, { signal: controller.signal });

            logger.debug('Ollama API response', {
                service: 'ai',
                metadata: { supervisorId, weekNumber, year }
            });

            if (!response || !response.response) {
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            // Stream parse response
            suggestions = [];
            try {
                suggestions = JSON.parse(response.response); // Directly parse the response
            } catch (parseError) {
                logger.error('Failed to parse AI response', {
                    service: 'ai',
                    metadata: { supervisorId, weekNumber, year, error: parseError.message }
                });
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            // Validate suggestions format
            if (!Array.isArray(suggestions)) {
                if (suggestions.suggestions && Array.isArray(suggestions.suggestions)) {
                    suggestions = suggestions.suggestions;
                } else {
                    logger.error('AI response is not an array', {
                        service: 'ai',
                        metadata: { supervisorId, weekNumber, year, suggestions }
                    });
                    return [];
                }
            }

            // Cache AI response
            cache.set(cacheKey, suggestions);

            // Transform suggestions
            const transformedSuggestions = suggestions.map(suggestion => {
                if (!suggestion.agentID || !Array.isArray(suggestion.schedule)) {
                    logger.warn('Invalid suggestion structure, skipping', {
                        service: 'ai',
                        metadata: { supervisorId, weekNumber, year, suggestion }
                    });
                    return null;
                }
                return {
                    agentID: suggestion.agentID,
                    schedule: suggestion.schedule.map(day => {
                        if (!day.date || !Array.isArray(day.visits)) {
                            logger.warn('Invalid schedule structure, skipping day', {
                                service: 'ai',
                                metadata: { supervisorId, weekNumber, year, day }
                            });
                            return null;
                        }
                        return {
                            date: day.date,
                            visits: day.visits
                                .map(visit => ({
                                    startTime: visit.startTime,
                                    location: visit.location,
                                    latitude: visit.latitude,
                                    longitude: visit.longitude,
                                    reasons: Array.isArray(visit.reasons)
                                        ? visit.reasons.map(reason => typeof reason === 'string' && reasonMap[reason] ? reasonMap[reason] : reason)
                                            .filter(r => r && r.id && r.item)
                                        : [],
                                    checklists: Array.isArray(visit.checklists)
                                        ? visit.checklists.map(checklist => typeof checklist === 'string' && checklistMap[checklist] ? checklistMap[checklist] : checklist)
                                            .filter(c => c && c.id && c.item)
                                        : []
                                }))
                                .sort((a, b) => distanceMap[suggestion.agentID] - distanceMap[suggestion.agentID] || // Use precomputed distance
                                    this.calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude))
                                .filter(visit => visit.reasons.length > 0 && visit.checklists.length > 0)
                        };
                    }).filter(day => day && day.visits.length > 0)
                };
            }).filter(suggestion => suggestion && suggestion.schedule.length > 0);

            logger.info('Timesheet suggestions generated', {
                service: 'ai',
                metadata: { supervisorId, weekNumber, year, suggestionCount: transformedSuggestions.length }
            });

            return transformedSuggestions;
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.info('AI request canceled', {
                    service: 'ai',
                    metadata: { supervisorId, weekNumber, year }
                });
                const abortError = new Error(ERROR_MESSAGES.REQUEST_CANCELED);
                abortError.status = 499; // Client Closed Request
                throw abortError;
            }
            logger.error('Failed to generate timesheet suggestions', {
                error: error.message,
                stack: error.stack,
                service: 'ai',
                metadata: { supervisorId, weekNumber, year }
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
     * @param {AbortController} [controller] - Optional AbortController to cancel the request.
     * @returns {Promise<Array>} List of detected anomalies.
     */
    static async detectAnomalies(dataType, data, controller = new AbortController()) {
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

            const response = await makeOllamaApiCall('post', '/generate', payload, { signal: controller.signal });

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
            if (error.name === 'AbortError') {
                logger.info('Anomaly detection request canceled', {
                    service: 'ai',
                    metadata: { dataType }
                });
                const abortError = new Error(ERROR_MESSAGES.REQUEST_CANCELED);
                abortError.status = 499;
                throw abortError;
            }
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
     * @param {AbortController} [controller] - Optional AbortController to cancel the request.
     * @returns {Promise<Object>} Generated report data.
     */
    static async generateReport(filters, format, controller = new AbortController()) {
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

            const response = await makeOllamaApiCall('post', '/generate', payload, { signal: controller.signal });

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
            if (error.name === 'AbortError') {
                logger.info('Report generation request canceled', {
                    service: 'ai',
                    metadata: { format }
                });
                const abortError = new Error(ERROR_MESSAGES.REQUEST_CANCELED);
                abortError.status = 499;
                throw abortError;
            }
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