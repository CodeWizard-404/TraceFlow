const { makeOllamaApiCall } = require('../utils/apiClient');
const { initializeAI } = require('../config/ai');
const { AIConfig, User, Agent, Reason, Checklist, Delegation } = require('../models');
const GoogleMapsService = require('./googleMapsService');
const { Op } = require('sequelize');
const NodeCache = require('node-cache');

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
    NO_AGENTS_AVAILABLE: 'No agents available for timesheet suggestions.',
    NO_REASONS_AVAILABLE: 'No reasons available for timesheet suggestions.',
    NO_CHECKLISTS_AVAILABLE: 'No checklists available for timesheet suggestions.',
    INVALID_TIME_INTERVAL: 'Invalid time interval provided.',
    REQUEST_CANCELED: 'AI request was canceled.',
    INVALID_AI_JSON: 'Failed to extract valid JSON from AI response.',
    NO_SUPERVISOR_LOCATION: 'Could not determine supervisor location.',
    NO_RECRUITMENT_LOCATIONS: 'Could not geocode recruitment areas.',
    MISSING_COORDINATES: 'Supervisor coordinates are required.'
};

class AIService {
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

    static getDateString(weekStart, dayOffset) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }

    static convertTo24Hour(time12h) {
        const [time, modifier] = time12h.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    static calculateDistance(lat1, lon1, lat2, lon2) {
        if (typeof lat1 !== 'number' || isNaN(lat1) || typeof lon1 !== 'number' || isNaN(lon1) ||
            typeof lat2 !== 'number' || isNaN(lat2) || typeof lon2 !== 'number' || isNaN(lon2)) {
            return Infinity;
        }
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    static async getCachedReasons() {
        let reasons = cache.get('reasons');
        if (!reasons) {
            reasons = await Reason.findAll({ attributes: ['reasonID', 'item'] });
            if (reasons.length === 0) {
                const error = new Error(ERROR_MESSAGES.NO_REASONS_AVAILABLE);
                error.status = 400;
                throw error;
            }
            cache.set('reasons', reasons);
        }
        return reasons;
    }

    static async getCachedChecklists() {
        let checklists = cache.get('checklists');
        if (!checklists) {
            checklists = await Checklist.findAll({ attributes: ['checklistID', 'item'] });
            if (checklists.length === 0) {
                const error = new Error(ERROR_MESSAGES.NO_CHECKLISTS_AVAILABLE);
                error.status = 400;
                throw error;
            }
            cache.set('checklists', checklists);
        }
        return checklists;
    }

    static extractJsonFromResponse(responseText) {
        const arrayMatch = responseText.match(/^\s*\[[\s\S]*?\]\s*$/);
        if (arrayMatch && arrayMatch[0]) {
            return arrayMatch[0];
        }
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
            return jsonMatch[1];
        }
        const fallbackMatch = responseText.match(/\[[\s\S]*?\]/);
        if (fallbackMatch && fallbackMatch[0]) {
            return fallbackMatch[0];
        }
        throw new Error('No valid JSON array found in response');
    }

    static async generateTimesheetSuggestions(supervisorId, weekNumber, year, timesheetData, controller = new AbortController()) {
        try {
            cache.flushAll();
            const supervisor = await User.findByPk(supervisorId, { attributes: ['userID'] });
            if (!supervisor) {
                const error = new Error(ERROR_MESSAGES.INVALID_SUPERVISOR);
                error.status = 404;
                throw error;
            }

            const weekStart = this.getWeekStartDate(weekNumber, year);
            const weekStartString = weekStart.toISOString().split('T')[0];

            const today = new Date('2025-05-21T19:57:00.000Z'); // 20:57 CET
            const isCurrentWeek = year === today.getUTCFullYear() && weekNumber === Math.floor((today - new Date(Date.UTC(today.getUTCFullYear(), 0, 4 - ((new Date(Date.UTC(today.getUTCFullYear(), 0, 4)).getUTCDay() || 7) - 1)))) / (7 * 24 * 60 * 60 * 1000)) + 1;

            const {
                delegationIds = [],
                agentIds = [],
                criteria = {},
                preferredDays = [],
                timeInterval,
                maxVisitsPerAgentPerWeek = 1,
                includeRecruitmentVisits = false,
                coordinates
            } = timesheetData;

            if (!timeInterval || !Number.isInteger(timeInterval.startHour) || !Number.isInteger(timeInterval.endHour) ||
                timeInterval.startHour < 0 || timeInterval.endHour > 24 || timeInterval.startHour >= timeInterval.endHour) {
                const error = new Error(ERROR_MESSAGES.INVALID_TIME_INTERVAL);
                error.status = 400;
                throw error;
            }

            // Adjust time interval for today
            let adjustedStartHour = timeInterval.startHour;
            if (isCurrentWeek && weekStartString === today.toISOString().split('T')[0]) {
                const currentHour = today.getUTCHours() + 1; // CET is UTC+1
                const currentMinutes = today.getUTCMinutes();
                adjustedStartHour = Math.max(timeInterval.startHour, Math.ceil((currentHour * 60 + currentMinutes) / 60));
            }

            if (!coordinates || !coordinates.lat || !coordinates.lng) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_COORDINATES), { status: 400 });
            }
            let supervisorLocation;
            try {
                const locationData = await GoogleMapsService.getCurrentUserLocation(supervisorId, coordinates);
                supervisorLocation = {
                    latitude: locationData.latitude,
                    longitude: locationData.longitude,
                    formattedAddress: locationData.address
                };
            } catch (error) {
                throw Object.assign(new Error(ERROR_MESSAGES.NO_SUPERVISOR_LOCATION), { status: 400, details: error.message });
            }

            // Calculate valid dates
            let daysOfWeek = preferredDays.length > 0
                ? preferredDays
                : Array.from({ length: 7 }, (_, i) => this.getDateString(weekStart, i));
            const todayDate = today.toISOString().split('T')[0]; // 2025-05-21
            daysOfWeek = daysOfWeek.filter(date => date >= todayDate);
            if (daysOfWeek.length === 0) {
                return [];
            }

            // Fetch agents and delegations
            const [agents, reasons, checklists, delegations] = await Promise.all([
                Agent.findAll({
                    where: {
                        supervisorID: supervisorId,
                        ...(agentIds.length > 0 && { agentID: { [Op.in]: agentIds } }),
                        ...(delegationIds.length > 0 && { delegationID: { [Op.in]: delegationIds } })
                    },
                    attributes: ['agentID', 'name', 'lastname', 'location', 'latitude', 'longitude', 'delegationID'],
                    include: [{ model: Delegation, attributes: ['name', 'latitude', 'longitude'] }]
                }),
                this.getCachedReasons(),
                this.getCachedChecklists(),
                Delegation.findAll({
                    where: delegationIds.length > 0 ? { delegationID: { [Op.in]: delegationIds } } : {},
                    attributes: ['delegationID', 'name', 'latitude', 'longitude']
                })
            ]);

            if (agents.length === 0 && !includeRecruitmentVisits) {
                throw Object.assign(new Error(ERROR_MESSAGES.NO_AGENTS_AVAILABLE), { status: 400 });
            }

            const delegationMap = new Map(delegations.map(d => [d.delegationID, { latitude: d.latitude, longitude: d.longitude }]));

            const agentData = agents.map(agent => ({
                agentID: agent.agentID,
                location: agent.location || null,
                latitude: agent.latitude || delegationMap.get(agent.delegationID)?.latitude || null,
                longitude: agent.longitude || delegationMap.get(agent.delegationID)?.longitude || null,
                delegationID: agent.delegationID
            }));

            // Geocode recruitment areas
            let recruitmentVisitLocations = [];
            if (includeRecruitmentVisits && criteria.recruitmentAreas?.length > 0) {
                recruitmentVisitLocations = await Promise.all(
                    criteria.recruitmentAreas.map(async area => {
                        try {
                            const geocode = await GoogleMapsService.geocodeAddress(`${area}, Tunisia`, 'tn');
                            return {
                                latitude: geocode.latitude,
                                longitude: geocode.longitude,
                                formattedAddress: geocode.formattedAddress
                            };
                        } catch (error) {
                            return { latitude: null, longitude: null, formattedAddress: 'Recruitment Location' };
                        }
                    })
                );
            } else if (includeRecruitmentVisits) {
                recruitmentVisitLocations = [{ latitude: null, longitude: null, formattedAddress: 'Recruitment Location' }];
            }

            const reasonMap = {};
            reasons.forEach(r => { reasonMap[r.reasonID] = { id: r.reasonID, item: r.item }; });
            const checklistMap = {};
            checklists.forEach(c => { checklistMap[c.checklistID] = { id: c.checklistID, item: c.item }; });

            // Prepare AI prompt
            const aiConfig = await initializeAI();
            const config = (await AIConfig.findOne({ where: { supervisorId }, attributes: ['modelName', 'timesheetMaxSuggestions'] })) || aiConfig;

            const prompt = `Generate timesheet visit suggestions for supervisor ${supervisorId} for week ${weekNumber} of ${year} starting ${weekStartString}.
- Dates: ${daysOfWeek.join(',')}
- Time Interval: ${adjustedStartHour}:00-${timeInterval.endHour}:00
- Current Date: 2025-05-21
- Current Time: 20:57
- Agents: ${agentData.length > 0 ? agentData.map(a => `${a.agentID}`).join(',') : 'none'}
- Reasons: ${reasons.map(r => `${r.reasonID}:${r.item}`).join(';')}
- Checklists: ${checklists.map(c => `${c.checklistID}:${c.item}`).join(';')}
${includeRecruitmentVisits ? `- Recruitment Visit Locations: ${recruitmentVisitLocations.map(l => l.formattedAddress).join(';')}` : ''}
Return a JSON array of visit objects: [{"date":"YYYY-MM-DD","time":"HH:MM","agentID":"string|null","location":"string|null","reasons":[{"id":"string"}],"checklists":[{"id":"string"}]}]
- Generate visits for the provided dates only: ${daysOfWeek.join(',')}.
- For visits on 2025-05-21, ensure time is after 20:57.
- ${includeRecruitmentVisits ? 'Include recruitment visits with agentID: null and location from Recruitment Visit Locations or "Recruitment Location" if none provided.' : 'Do not include visits with agentID: null.'}
- For non-recruitment visits, agentID must be one of: ${agentData.length > 0 ? agentData.map(a => a.agentID).join(',') : 'none'}.
- Ensure at least 1 reason per visit, selected based on relevance to the visit context (e.g., "Inventory discrepancy" for inventory-related visits).
- Include at least 1 checklist per visit, chosen to match the reasons (e.g., if reason is "Inventory discrepancy," select "Verify store inventory").
- Ensure date is in YYYY-MM-DD format and time is in HH:MM (24-hour) format within the time interval.
- Ensure unique times for visits on the same day with at least a 1-hour gap.
- Return only the JSON array without additional text or formatting.`;

            const payload = {
                model: 'mistral',
                prompt,
                stream: false
            };

            let response;
            try {
                console.log('Sending request to Ollama:', { payload });
                response = await makeOllamaApiCall('post', '/generate', payload, { signal: controller.signal });
                console.log('Raw Ollama response:', response);
            } catch (error) {
                console.error('AI API Error:', error);
                throw Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503, details: error.message });
            }

            if (!response || !response.response) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE), { status: 503, details: 'No response data from AI service.' });
            }

            let suggestionsRaw;
            try {
                const jsonString = this.extractJsonFromResponse(response.response);
                console.log('Extracted JSON:', jsonString);
                suggestionsRaw = JSON.parse(jsonString);
            } catch (parseError) {
                console.error('Parse Error:', parseError, 'Raw Response:', response.response);
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_AI_JSON), { status: 503, details: `Failed to extract or parse JSON: ${parseError.message}` });
            }

            if (!Array.isArray(suggestionsRaw)) {
                console.warn('AI response is not an array:', suggestionsRaw);
                return [];
            }

            const cacheKey = `${supervisorId}-${weekNumber}-${year}-${JSON.stringify(timesheetData)}`;
            cache.set(cacheKey, suggestionsRaw);

            return suggestionsRaw;
        } catch (error) {
            if (error.name === 'AbortError') {
                const abortError = new Error(ERROR_MESSAGES.REQUEST_CANCELED);
                abortError.status = 499;
                throw abortError;
            }
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503, details: error.message });
        }
    }

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
            const prompt = `Analyze ${dataType} data: ${JSON.stringify(data)}. Detect anomalies with a confidence threshold of ${config.anomalyThreshold}. Return a JSON array of anomalies with explanations. Return only the JSON array without additional text or formatting.`;

            const payload = {
                model: 'mistral',
                prompt,
                stream: false
            };

            const response = await makeOllamaApiCall('post', '/generate', payload, { signal: controller.signal });

            if (!response || !response.response) {
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            let anomalies;
            try {
                const jsonString = this.extractJsonFromResponse(response.response);
                anomalies = JSON.parse(jsonString);
            } catch (parseError) {
                throw new Error(ERROR_MESSAGES.INVALID_AI_JSON);
            }

            if (!Array.isArray(anomalies)) {
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            return anomalies;
        } catch (error) {
            if (error.name === 'AbortError') {
                const abortError = new Error(ERROR_MESSAGES.REQUEST_CANCELED);
                abortError.status = 499;
                throw abortError;
            }
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503 });
        }
    }

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
            const prompt = `Generate a ${format} report based on filters: ${JSON.stringify(filters)}. Include summaries and visualizations where applicable. Return the response as a JSON object. Return only the JSON object without additional text or formatting.`;

            const payload = {
                model: 'mistral',
                prompt,
                stream: false
            };

            const response = await makeOllamaApiCall('post', '/generate', payload, { signal: controller.signal });

            if (!response || !response.response) {
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            let report;
            try {
                const jsonString = this.extractJsonFromResponse(response.response);
                report = JSON.parse(jsonString);
            } catch (parseError) {
                throw new Error(ERROR_MESSAGES.INVALID_AI_JSON);
            }

            return report;
        } catch (error) {
            if (error.name === 'AbortError') {
                const abortError = new Error(ERROR_MESSAGES.REQUEST_CANCELED);
                abortError.status = 499;
                throw abortError;
            }
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503 });
        }
    }
}

module.exports = AIService;