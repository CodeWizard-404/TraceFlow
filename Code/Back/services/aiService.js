const { makeOllamaApiCall } = require('../utils/apiClient');
const { initializeAI } = require('../config/ai');
const { AIConfig, User, Agent, Reason, Checklist, Delegation } = require('../models');
const GoogleMapsService = require('./GoogleMapsService');
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

            // Check if the chosen week is the current week
            const today = new Date('2025-05-18T03:57:00.000Z'); // Hardcoded for May 18, 2025, 03:57 AM CET
            const jan4 = new Date(Date.UTC(today.getUTCFullYear(), 0, 4));
            const dayOfWeek = jan4.getUTCDay() || 7;
            const firstMonday = new Date(Date.UTC(today.getUTCFullYear(), 0, 4 - (dayOfWeek - 1)));
            const currentWeekNumber = Math.floor((today - firstMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;
            const isCurrentWeek = year === today.getUTCFullYear() && weekNumber === currentWeekNumber;

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

            let supervisorLocation;
            if (!coordinates || !coordinates.lat || !coordinates.lng) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_COORDINATES), { status: 400 });
            }
            try {
                const locationData = await GoogleMapsService.getCurrentUserLocation(supervisorId, coordinates);
                supervisorLocation = {
                    latitude: locationData.latitude,
                    longitude: locationData.longitude,
                    formattedAddress: locationData.address
                };
            } catch (error) {
                console.error('Supervisor Location Error:', error);
                throw Object.assign(new Error(ERROR_MESSAGES.NO_SUPERVISOR_LOCATION), { status: 400, details: error.message });
            }

            let recruitmentVisitLocations = [];
            if (includeRecruitmentVisits && criteria.recruitmentAreas?.length > 0) {
                try {
                    recruitmentVisitLocations = await Promise.all(
                        criteria.recruitmentAreas.map(async area => {
                            const geocode = await GoogleMapsService.geocodeAddress(`${area}, Tunisia`, 'tn');
                            return {
                                latitude: geocode.latitude,
                                longitude: geocode.longitude,
                                formattedAddress: geocode.formattedAddress
                            };
                        })
                    );
                } catch (error) {
                    console.error('Recruitment Areas Geocoding Error:', error);
                    throw Object.assign(new Error(ERROR_MESSAGES.NO_RECRUITMENT_LOCATIONS), { status: 400, details: error.message });
                }
            }

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

            if (agents.length === 0 && !includeRecruitmentVisits) {
                const error = new Error(ERROR_MESSAGES.NO_AGENTS_AVAILABLE);
                error.status = 400;
                throw error;
            }

            const agentData = agents.map(agent => ({
                agentID: agent.agentID,
                name: agent.name,
                lastname: agent.lastname,
                location: agent.location || 'Unknown',
                latitude: agent.latitude,
                longitude: agent.longitude,
                delegation: agent.Delegation?.name || 'Unknown',
            }));

            if (agentIds.length > 0 && agentData.length !== agentIds.length) {
                const error = new Error(ERROR_MESSAGES.INVALID_AGENTS);
                error.status = 400;
                throw error;
            }

            const reasonMap = {};
            reasons.forEach(r => { reasonMap[r.reasonID] = { id: r.reasonID, item: r.item }; });
            const checklistMap = {};
            checklists.forEach(c => { checklistMap[c.checklistID] = { id: c.checklistID, item: c.item }; });

            const reasonChecklistMapping = {};
            reasons.forEach(reason => {
                reasonChecklistMapping[reason.reasonID] = checklists
                    .filter(checklist => {
                        const reasonText = reason.item.toLowerCase();
                        const checklistText = checklist.item.toLowerCase();
                        return reasonText.split(/\s+/).some(word => checklistText.includes(word)) ||
                            checklistText.split(/\s+/).some(word => reasonText.includes(word)) ||
                            (criteria.description && checklistText.includes(criteria.description.toLowerCase()));
                    })
                    .map(checklist => checklist.checklistID)
                    .slice(0, 3);
            });

            let daysOfWeek = preferredDays.length > 0
                ? preferredDays.map((_, index) => this.getDateString(weekStart, index))
                : Array.from({ length: 7 }, (_, i) => this.getDateString(weekStart, i));

            // If current week, filter out days before today
            if (isCurrentWeek) {
                const todayDate = today.toISOString().split('T')[0]; // 2025-05-18
                daysOfWeek = daysOfWeek.filter(date => date >= todayDate);
                if (daysOfWeek.length === 0) {
                    return []; // No valid days left
                }
            }

            const distanceMap = {};
            agentData.forEach(agent => {
                distanceMap[agent.agentID] = this.calculateDistance(
                    supervisorLocation.latitude,
                    supervisorLocation.longitude,
                    agent.latitude,
                    agent.longitude
                );
            });

            const cacheKey = `${supervisorId}-${weekNumber}-${year}-${JSON.stringify(timesheetData)}`;
            let suggestions = cache.get(cacheKey);
            if (suggestions) {
                return suggestions;
            }

            const aiConfig = await initializeAI();
            const config = (await AIConfig.findOne({ where: { supervisorId }, attributes: ['modelName', 'timesheetMaxSuggestions'] })) || aiConfig;

            const prompt = `Generate up to ${config.timesheetMaxSuggestions} timesheet suggestions for supervisor ${supervisorId} for week ${weekNumber} of ${year} starting ${weekStartString}.
- Agents: ${agentData.map(a => `${a.agentID}:${a.latitude !== null && !isNaN(a.latitude) ? a.latitude : 'null'},${a.longitude !== null && !isNaN(a.longitude) ? a.longitude : 'null'},${a.location}`).join(';')}
- Reasons: ${reasons.map(r => `${r.reasonID}:${r.item}`).join(';')}
- Checklists: ${checklists.map(c => `${c.checklistID}:${c.item}`).join(';')}
- Reason-Checklist Mapping: ${JSON.stringify(reasonChecklistMapping)}
- Dates: ${daysOfWeek.join(',')}
- Supervisor Location: ${supervisorLocation.latitude},${supervisorLocation.longitude}
- Time Interval: ${timeInterval.startHour}:00-${timeInterval.endHour}:00
- Max Visits Per Agent: ${maxVisitsPerAgentPerWeek}
- Include Recruitment Visits: ${includeRecruitmentVisits}
- Recruitment Visit Locations: ${recruitmentVisitLocations.length > 0 ? recruitmentVisitLocations.map(l => `${l.latitude},${l.longitude},${l.formattedAddress}`).join(';') : 'none'}
- Criteria: ${JSON.stringify(criteria)}
- Visit Description: ${criteria.description || 'No specific description provided'}
- Current Date: 2025-05-18
- Is Current Week: ${isCurrentWeek}
Return a JSON array of objects: [{"agentID":"string","schedule":[{"date":"YYYY-MM-DD","visits":[{"time":"HH:MM","location":"string","latitude":number,"longitude":number,"reasons":[{"id":"string"}],"checklists":[{"id":"string"}]}]}],"supervisorID":"string"}]
- Use only the provided agent IDs: ${agentData.map(a => a.agentID).join(',')} for non-recruitment visits.
- For recruitment visits (if enabled), set agentID to null and use recruitment visit locations.
- For non-recruitment visits, use the agent's location if no specific location is provided.
- For agents with null coordinates, set latitude and longitude to null in the response.
- Ensure exactly 1-2 reasons per visit, selected based on the visit description.
- Ensure exactly 1-3 checklists per visit, selected from the Reason-Checklist Mapping to be contextually related to the chosen reasons.
- Use the visit description to prioritize reasons and checklists (e.g., select inventory-related reasons and checklists if description mentions inventory).
- If Is Current Week is true, only include visits on or after 2025-05-18.
- Ensure visits on the same day for the same agent or recruitment visit have unique times with at least a 1-hour gap between them (e.g., 09:00 and 10:00 are valid, but 09:00 and 09:30 are not).
- Ensure reasons and checklists are non-empty arrays of objects with id fields, e.g., {"id":"rea_001"}.
- Ensure date is in YYYY-MM-DD format and time is in HH:MM (24-hour) format.
- Ensure time, date, reasons, and checklists are non-empty for all visits.
- Sort visits by distance from supervisor using Haversine formula for agents with valid coordinates. For agents with null coordinates or recruitment visits, assign visits without sorting by distance.
- Include supervisorID in each suggestion object.
- Return an empty array if insufficient data or no valid dates remain.
- Return only the JSON array without additional text or formatting.`;

            const payload = {
                model: config.modelName,
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
                suggestionsRaw = [];
            }

            cache.set(cacheKey, suggestionsRaw);

            const transformedSuggestions = suggestionsRaw.map(suggestion => {
                const isRecruitmentVisit = includeRecruitmentVisits && suggestion.agentID === null;
                if (!isRecruitmentVisit && (!suggestion.agentID || !agentData.find(a => a.agentID === suggestion.agentID))) {
                    console.warn('Invalid agentID:', suggestion.agentID);
                    return null;
                }
                if (!Array.isArray(suggestion.schedule) || suggestion.supervisorID !== supervisorId) {
                    return null;
                }
                return {
                    agentID: suggestion.agentID,
                    supervisorID: suggestion.supervisorID,
                    schedule: suggestion.schedule.map(day => {
                        if (!day.date || !Array.isArray(day.visits)) {
                            return null;
                        }
                        // Additional validation for current week
                        if (isCurrentWeek && day.date < '2025-05-18') {
                            return null;
                        }
                        // Validate time gaps
                        const visitTimes = day.visits.map(v => v.time).filter(t => t);
                        const timeToMinutes = (time) => {
                            const [hours, minutes] = time.split(':').map(Number);
                            return hours * 60 + minutes;
                        };
                        const sortedTimes = visitTimes
                            .map(time => ({ time, minutes: timeToMinutes(time) }))
                            .sort((a, b) => a.minutes - b.minutes);
                        for (let i = 1; i < sortedTimes.length; i++) {
                            if (sortedTimes[i].minutes === sortedTimes[i - 1].minutes) {
                                console.warn(`Duplicate visit time ${sortedTimes[i].time} on ${day.date}`);
                                return null; // Duplicate times
                            }
                            if (sortedTimes[i].minutes - sortedTimes[i - 1].minutes < 60) {
                                console.warn(`Insufficient time gap between ${sortedTimes[i - 1].time} and ${sortedTimes[i].time} on ${day.date}`);
                                return null; // Less than 1-hour gap
                            }
                        }
                        return {
                            date: day.date,
                            visits: day.visits
                                .map(visit => {
                                    if (!visit.time || !visit.location) {
                                        return null;
                                    }
                                    const reasons = Array.isArray(visit.reasons)
                                        ? visit.reasons.map(reason => {
                                            if (typeof reason === 'string' && reasonMap[reason]) {
                                                return { id: reason };
                                            } else if (reason && reason.id && reasonMap[reason.id]) {
                                                return { id: reason.id };
                                            }
                                            return null;
                                        }).filter(r => r && r.id)
                                        : [];
                                    const checklists = Array.isArray(visit.checklists)
                                        ? visit.checklists.map(checklist => {
                                            if (typeof checklist === 'string' && checklistMap[checklist]) {
                                                return { id: checklist };
                                            } else if (checklist && checklist.id && checklistMap[checklist.id]) {
                                                return { id: checklist.id };
                                            }
                                            return null;
                                        }).filter(c => c && c.id)
                                        : [];
                                    if (reasons.length < 1 || reasons.length > 2 || checklists.length < 1 || checklists.length > 3) {
                                        return null;
                                    }
                                    return {
                                        time: visit.time.includes('AM') || visit.time.includes('PM') ? this.convertTo24Hour(visit.time) : visit.time,
                                        location: visit.location,
                                        latitude: visit.latitude,
                                        longitude: visit.longitude,
                                        reasons,
                                        checklists
                                    };
                                })
                                .filter(visit => visit)
                                .sort((a, b) => {
                                    if (isRecruitmentVisit) {
                                        return 0;
                                    }
                                    const agent = agentData.find(ag => ag.agentID === suggestion.agentID);
                                    if (!agent || agent.latitude === null || isNaN(agent.latitude) || agent.longitude === null || isNaN(agent.longitude)) {
                                        return 0;
                                    }
                                    return this.calculateDistance(
                                        supervisorLocation.latitude, supervisorLocation.longitude, a.latitude, a.longitude
                                    ) - this.calculateDistance(
                                        supervisorLocation.latitude, supervisorLocation.longitude, b.latitude, b.longitude
                                    );
                                })
                        };
                    }).filter(day => day && day.visits.length > 0)
                };
            }).filter(suggestion => suggestion && suggestion.schedule.length > 0);

            return transformedSuggestions;
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