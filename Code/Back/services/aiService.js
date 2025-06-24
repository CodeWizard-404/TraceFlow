const { makeOllamaApiCall } = require('../utils/apiClient');
const { initializeAI } = require('../config/ai');
const { AIConfig, User, Role, Agent, Reason, Checklist, Delegation, sequelize } = require('../models');
const GoogleMapsService = require('./googleMapsService');
const { Op } = require('sequelize');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');

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
    MISSING_COORDINATES: 'Supervisor coordinates are required.',
    MAX_SUGGESTIONS_REACHED: 'Maximum timesheet suggestions limit reached. Try again in 24 hours.'
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




    static async generateTimesheetSuggestions(supervisorId, weekNumber, year, timesheetData, controller = new AbortController()) {
        try {

            // Clear cache
            cache.flushAll();

            // Fetch supervisor
            const supervisor = await User.findByPk(supervisorId, { attributes: ['userID'] });
            if (!supervisor) {
                const error = new Error(ERROR_MESSAGES.INVALID_SUPERVISOR);
                error.status = 404;
                throw error;
            }

            // Calculate week start
            const weekStart = this.getWeekStartDate(weekNumber, year);
            const weekStartString = weekStart.toISOString().split('T')[0];

            // Get current time
            const today = new Date();
            const currentHour = today.getUTCHours() + 1; // Adjust for CET
            const currentMinutes = today.getUTCMinutes();
            const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

            // Check if current week
            const isCurrentWeek = year === today.getUTCFullYear() && weekNumber === Math.floor((today - new Date(Date.UTC(today.getUTCFullYear(), 0, 4 - ((new Date(Date.UTC(today.getUTCFullYear(), 0, 4)).getUTCDay() || 7) - 1)))) / (7 * 24 * 60 * 60 * 1000)) + 1;

            // Destructure timesheetData
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

            // Validate time interval
            if (!timeInterval || !Number.isInteger(timeInterval.startHour) || !Number.isInteger(timeInterval.endHour) ||
                timeInterval.startHour < 0 || timeInterval.endHour > 24 || timeInterval.startHour >= timeInterval.endHour) {
                const error = new Error(ERROR_MESSAGES.INVALID_TIME_INTERVAL);
                error.status = 400;
                throw error;
            }

            // Adjust start hour for current day
            let adjustedStartHour = timeInterval.startHour;
            if (isCurrentWeek && weekStartString === today.toISOString().split('T')[0]) {
                adjustedStartHour = Math.max(timeInterval.startHour, Math.ceil((currentHour * 60 + currentMinutes) / 60));
            }

            // Validate coordinates
            if (!coordinates || !coordinates.lat || !coordinates.lng) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_COORDINATES), { status: 400 });
            }

            // Fetch supervisor location
            let supervisorLocation = { latitude: coordinates.lat, longitude: coordinates.lng, formattedAddress: 'Unknown' };
            try {
                const locationData = await GoogleMapsService.getCurrentUserLocation(supervisorId, coordinates);
                supervisorLocation = {
                    latitude: locationData.latitude,
                    longitude: locationData.longitude,
                    formattedAddress: locationData.address
                };
            } catch (error) {
                console.warn('Warning: Google API failed, continuing with provided coordinates');
                console.log('Using fallback coordinates', { supervisorLocation });
            }

            // Determine days of week
            let daysOfWeek = preferredDays.length > 0
                ? preferredDays
                : Array.from({ length: 7 }, (_, i) => this.getDateString(weekStart, i));

            // Filter past dates
            const todayDate = today.toISOString().split('T')[0];
            daysOfWeek = daysOfWeek.filter(date => date >= todayDate);

            // Filter current day if time has passed
            if (isCurrentWeek && daysOfWeek.includes(todayDate)) {
                const currentMinutesTotal = currentHour * 60 + currentMinutes;
                const endMinutes = timeInterval.endHour * 60;
                if (currentMinutesTotal >= endMinutes) {
                    daysOfWeek = daysOfWeek.filter(date => date !== todayDate);
                }
            }

            // Check if any days remain
            if (daysOfWeek.length === 0) {
                return [];
            }

            // Fetch agents, reasons, and checklists
            const [agents, reasons, checklists] = await Promise.all([
                Agent.findAll({
                    where: {
                        supervisorID: supervisorId,
                        ...(agentIds.length > 0 && { agentID: { [Op.in]: agentIds } }),
                        ...(delegationIds.length > 0 && { delegationID: { [Op.in]: delegationIds } })
                    },
                    attributes: ['agentID', 'name', 'lastname', 'location', 'latitude', 'longitude', 'delegationID'],
                    include: [{ model: Delegation, attributes: ['delegationID', 'name'] }]
                }),
                this.getCachedReasons(),
                this.getCachedChecklists()
            ]);

            // Validate agents
            if (agents.length === 0 && !includeRecruitmentVisits) {
                throw Object.assign(new Error(ERROR_MESSAGES.NO_AGENTS_AVAILABLE), { status: 400 });
            }

            // Process agent data
            const agentData = agents.map(agent => ({
                agentID: agent.agentID,
                location: agent.location || agent.Delegation?.name || 'Unknown',
                latitude: agent.latitude || null,
                longitude: agent.longitude || null,
                delegationID: agent.delegationID,
                delegationName: agent.Delegation?.name || 'Unknown'
            }));

            // Sort agents by proximity
            const sortedAgents = agentData.sort((a, b) => {
                const distA = this.calculateDistance(
                    supervisorLocation.latitude,
                    supervisorLocation.longitude,
                    a.latitude,
                    a.longitude
                );
                const distB = this.calculateDistance(
                    supervisorLocation.latitude,
                    supervisorLocation.longitude,
                    b.latitude,
                    b.longitude
                );
                if (distA === Infinity && distB !== Infinity) return 1;
                if (distB === Infinity && distA !== Infinity) return -1;
                return distA - distB;
            });

            // Handle recruitment visit locations
            let recruitmentVisitLocations = [];
            if (includeRecruitmentVisits && Array.isArray(criteria.recruitmentAreas) && criteria.recruitmentAreas.length > 0) {
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

            // Map reasons and checklists
            const reasonMap = {};
            reasons.forEach(r => { reasonMap[r.reasonID] = { id: r.reasonID, item: r.item }; });
            const checklistMap = {};
            checklists.forEach(c => { checklistMap[c.checklistID] = { id: c.checklistID, item: c.item }; });

            // Initialize AI config with transaction
            const transaction = await sequelize.transaction();
            try {
                const aiConfig = await initializeAI();
                let config = await AIConfig.findOne(
                    { where: { supervisorId }, attributes: ['configID', 'modelName', 'timesheetMaxSuggestions'] },
                    { transaction }
                );


                if (!config) {
                    // Validate supervisorId before creating
                    if (supervisorId) {
                        const supervisorExists = await User.findByPk(supervisorId, { transaction });
                        if (!supervisorExists) {
                            throw Object.assign(new Error(ERROR_MESSAGES.INVALID_SUPERVISOR), { status: 400 });
                        }
                    }

                    config = await AIConfig.create(
                        {
                            modelName: aiConfig.modelName || 'mistral',
                            timesheetMaxSuggestions: aiConfig.timesheetMaxSuggestions || 5,
                            supervisorId
                        },
                        { transaction }
                    );

                }

                // Check if config is a valid instance
                if (!(config instanceof AIConfig) || !config.configID) {
                    throw Object.assign(new Error('Invalid AIConfig instance or missing configID'), { status: 500 });
                }

                // Check max suggestions
                if (config.timesheetMaxSuggestions <= 0) {
                    throw Object.assign(new Error(ERROR_MESSAGES.MAX_SUGGESTIONS_REACHED), { status: 429 });
                }

                // Build prompt
                const prompt = `Generate timesheet visit suggestions for supervisor ${supervisorId} for week ${weekNumber} of ${year} starting ${weekStartString}.
- Dates: ${daysOfWeek.join(',')}
- Time Interval: ${adjustedStartHour}:00-${timeInterval.endHour}:00
- Current Date: ${todayDate}
- Current Time: ${currentTimeString}
- Supervisor Coordinates: lat: ${timesheetData.coordinates.lat}, lng: ${timesheetData.coordinates.lng}
- Agents: ${sortedAgents.length > 0 ? sortedAgents.map(a => `${a.agentID} (lat: ${a.latitude || 'unknown'}, lng: ${a.longitude || 'unknown'})`).join(',') : 'none'}
- Agent Locations for Sorting: ${sortedAgents.map(a => `${a.agentID}: ${a.location}`).join(';')}
- Reasons: ${reasons.map(r => `${r.reasonID}:${r.item}`).join(';')}
- Checklists: ${checklists.map(c => `${c.checklistID}:${c.item}`).join(';')}
- Recruitment Visit Locations: ${recruitmentVisitLocations.map(loc => loc.formattedAddress).join(',')}
Return a JSON array of visit objects: [{"date":"YYYY-MM-DD","time":"HH:MM","agentID":"string|null","reasons":[{"id":"string"}],"checklists":[{"id":"string"}]}]
- Generate visits for the provided dates: ${daysOfWeek.join(',')}.
- Ensure visit times are within ${adjustedStartHour}:00-${timeInterval.endHour}:00.
- ${isCurrentWeek && daysOfWeek.includes(todayDate) ? `For visits on ${todayDate}, ensure time is after ${currentTimeString}.` : ''}
- Include at least one recruitment visit with agentID: null if includeRecruitmentVisits is true.
- For non-recruitment visits, agentID must be one of: ${sortedAgents.length > 0 ? sortedAgents.map(a => a.agentID).join(',') : 'none'}.
- Sort non-recruitment visits by agent proximity to supervisor coordinates (${timesheetData.coordinates.lat}, ${timesheetData.coordinates.lng}) using agent latitude and longitude. If coordinates are unknown, prioritize agents with known coordinates. Use the haversine formula for distance calculation.
- Ensure at least 1 reason per visit in the format {"id": "string"}, selected based on relevance to the checklist.
- Ensure at least 1 checklist per visit in the format {"id": "string"}, selected based on relevance to the reasons, except for recruitment visits which may have no checklists.
- Ensure date is in YYYY-MM-DD format and time is in HH:MM (24-hour) format.
- Ensure unique times on the same day with at least a 1-hour gap.
- Return only the JSON array without additional text or formatting.`;

                // Make AI API call
                const payload = {
                    model: config.modelName || 'mistral',
                    prompt,
                    stream: false
                };

                let response;
                try {
                    response = await makeOllamaApiCall('post', '/generate', payload, { signal: controller.signal });
                } catch (error) {
                    throw Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503, details: error.message });
                }

                // Validate AI response
                if (!response || !response.response) {
                    throw Object.assign(new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE), { status: 503, details: 'No response data from AI service.' });
                }

                // Parse AI response
                let suggestionsRaw;
                try {
                    suggestionsRaw = JSON.parse(response.response.trim());
                } catch (parseError) {
                    throw Object.assign(new Error(ERROR_MESSAGES.INVALID_AI_JSON), { status: 503, details: `Failed to parse JSON: ${parseError.message}` });
                }

                // Validate suggestions format
                if (!Array.isArray(suggestionsRaw)) {
                    return [];
                }

                // Filter valid suggestions
                const validSuggestions = suggestionsRaw.filter((visit, index) => {
                    if (!visit.date || !daysOfWeek.includes(visit.date) || visit.date < todayDate) {
                        return false;
                    }

                    const timeMatch = visit.time && visit.time.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/);
                    if (!timeMatch) {
                        return false;
                    }

                    const [hours, minutes] = visit.time.split(':').map(Number);
                    const visitMinutes = hours * 60 + minutes;
                    if (
                        visitMinutes < adjustedStartHour * 60 ||
                        visitMinutes >= timeInterval.endHour * 60 ||
                        (visit.date === todayDate && visitMinutes <= (currentHour * 60 + currentMinutes))
                    ) {
                        return false;
                    }

                    const isRecruitment = visit.agentID === null;
                    if (!isRecruitment && !sortedAgents.some(agent => agent.agentID === visit.agentID)) {
                        return false;
                    }

                    if (!Array.isArray(visit.reasons) || visit.reasons.length === 0 || !visit.reasons.every(r => r.id && reasonMap[r.id])) {
                        return false;
                    }

                    if (!isRecruitment && (!Array.isArray(visit.checklists) || visit.checklists.length === 0 || !visit.checklists.every(c => c.id && checklistMap[c.id]))) {
                        return false;
                    }

                    return true;
                });

                // Ensure recruitment visit if required
                if (includeRecruitmentVisits && !validSuggestions.some(visit => visit.agentID === null)) {
                    validSuggestions.push({
                        date: daysOfWeek[0],
                        time: `${adjustedStartHour.toString().padStart(2, '0')}:00`,
                        agentID: null,
                        reasons: [{ id: reasons[0].reasonID }],
                        checklists: []
                    });
                }

                // Update AI config only if valid suggestions exist and limit allows
                if (validSuggestions.length > 0 && config.timesheetMaxSuggestions > 0) {
                    await config.update(
                        {
                            timesheetMaxSuggestions: config.timesheetMaxSuggestions - 1
                        },
                        { transaction }
                    );
                }

                // Cache results
                const cacheKey = `${supervisorId}-${weekNumber}-${year}-${JSON.stringify(timesheetData)}`;
                cache.set(cacheKey, validSuggestions);

                await transaction.commit();
                return validSuggestions;
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
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


















    static async optimizeRoute(origin, allPoints = [], mode = 'driving', trafficModel = 'best_guess', distanceMatrix, controller = new AbortController()) {
        try {
            if (!origin) {
                throw Object.assign(new Error('Origin is required'), { status: 400 });
            }

            allPoints.forEach((location, index) => {
                if (!/^-?\d+\.\d{1,15},-?\d+\.\d{1,15}$/.test(location)) {
                    throw Object.assign(new Error(`Invalid point location format at index ${index}: ${location}`), { status: 400 });
                }
            });

            if (!distanceMatrix || !Array.isArray(distanceMatrix)) {
                throw Object.assign(new Error('Invalid or missing distance matrix'), { status: 400 });
            }

            const validIndices = Array.from({ length: allPoints.length }, (_, i) => i);
            const aiConfig = await initializeAI();
            let config = await AIConfig.findOne({ attributes: ['maxOptimizeRoute'] }) || aiConfig;

            if (!config.maxOptimizeRoute) {
                config = await AIConfig.create({
                    modelName: aiConfig.modelName || 'mistral',
                    maxOptimizeRoute: aiConfig.maxOptimizeRoute || 5
                });
            }

            if (config.maxOptimizeRoute <= 0) {
                return this.fallbackOptimization(allPoints, distanceMatrix);
            }

            const prompt = `
Optimize the route starting from origin "${origin}" visiting points: ${allPoints.join(',') || 'none'}.
- Mode: ${mode}
- Traffic Model: ${trafficModel}
- Distance Matrix: ${JSON.stringify(distanceMatrix)}
- Current Date: 2025-06-03
- Current Time: 15:18 CET
Objective: Find the shortest and fastest route with minimal traffic, starting at origin.
Constraints:
- Exactly ${allPoints.length} points must be visited once.
- Start at origin.
- Do NOT require any specific point to be the final stop.
- Use traffic conditions from the distance matrix (duration in minutes).
- Prioritize lowest total duration, then lowest total distance.
Return a JSON object: {"waypointOrder": [number], "estimatedDuration": number, "estimatedDistance": number}
- waypointOrder: Exactly ${allPoints.length} unique indices from ${JSON.stringify(validIndices)}.
- estimatedDuration: Total duration in minutes.
- estimatedDistance: Total distance in kilometers.
Example for 2 points:
Input points: ["point1", "point2"]
Valid waypointOrder: [1, 0]
Output: {"waypointOrder": [1, 0], "estimatedDuration": 15.5, "estimatedDistance": 10.2}
Return only the JSON object without additional text or formatting.
            `;

            const payload = {
                model: config.modelName || 'mistral',
                prompt,
                stream: false
            };

            let response;
            try {
                response = await makeOllamaApiCall('post', '/generate', payload, { signal: controller.signal });
            } catch (error) {
                throw Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503, details: error.message });
            }

            if (!response || !response.response) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE), { status: 503, details: 'No response data from AI service.' });
            }

            let optimizationResult;
            try {
                const normalizedResponse = response.response.replace(/\s+/g, ' ').trim();
                const jsonString = this.extractJsonFromResponse(normalizedResponse);
                optimizationResult = JSON.parse(jsonString);
            } catch (parseError) {
                return this.fallbackOptimization(allPoints, distanceMatrix);
            }

            if (!optimizationResult || !Array.isArray(optimizationResult.waypointOrder)) {
                return this.fallbackOptimization(allPoints, distanceMatrix);
            }

            const isValidOrder = optimizationResult.waypointOrder.length === allPoints.length &&
                optimizationResult.waypointOrder.every(index => validIndices.includes(index)) &&
                new Set(optimizationResult.waypointOrder).size === allPoints.length;

            if (!isValidOrder) {
                return this.fallbackOptimization(allPoints, distanceMatrix);
            }

            await config.update({
                maxOptimizeRoute: config.maxOptimizeRoute - 1
            });

            return {
                waypointOrder: optimizationResult.waypointOrder,
                estimatedDuration: optimizationResult.estimatedDuration || 0,
                estimatedDistance: optimizationResult.estimatedDistance || 0
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                const abortError = new Error(ERROR_MESSAGES.REQUEST_CANCELED);
                abortError.status = 499;
                throw abortError;
            }
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error('Failed to optimize route'), { status: 500, details: error.message });
        }
    }

    static fallbackOptimization(allPoints, distanceMatrix) {
        if (!allPoints.length) {
            return { waypointOrder: [], estimatedDuration: 0, estimatedDistance: 0 };
        }

        const n = allPoints.length;
        const visited = new Set();
        const waypointOrder = [];
        let currentIndex = null;
        let totalDuration = 0;
        let totalDistance = 0;

        while (visited.size < n) {
            let minDuration = Infinity;
            let nextIndex = null;

            for (let i = 0; i < n; i++) {
                if (!visited.has(i)) {
                    const duration = distanceMatrix[currentIndex !== null ? currentIndex + 1 : 0][i + 1]?.duration;
                    if (duration && duration < minDuration) {
                        minDuration = duration;
                        nextIndex = i;
                    }
                }
            }

            if (nextIndex === null) {
                break;
            }

            waypointOrder.push(nextIndex);
            visited.add(nextIndex);
            if (currentIndex !== null) {
                totalDuration += distanceMatrix[currentIndex + 1][nextIndex + 1]?.duration || 0;
                totalDistance += distanceMatrix[currentIndex + 1][nextIndex + 1]?.distance || 0;
            }
            currentIndex = nextIndex;
        }

        if (waypointOrder.length > 0) {
            totalDuration += distanceMatrix[0][waypointOrder[0] + 1]?.duration || 0;
            totalDistance += distanceMatrix[0][waypointOrder[0] + 1]?.distance || 0;
        }

        return {
            waypointOrder,
            estimatedDuration: totalDuration,
            estimatedDistance: totalDistance
        };
    }

    static extractJsonFromResponse(response) {
        // Extract JSON between first { and last }
        const start = response.indexOf('{');
        const end = response.lastIndexOf('}');
        if (start === -1 || end === -1 || start > end) {
            throw new Error('No valid JSON object found in response');
        }
        return response.slice(start, end + 1);
    }



    static fallbackOptimization(allPoints, distanceMatrix) {
        if (!allPoints.length) {
            return { waypointOrder: [], estimatedDuration: 0, estimatedDistance: 0 };
        }

        // Nearest neighbor heuristic
        const n = allPoints.length;
        const visited = new Set();
        const waypointOrder = [];
        let currentIndex = null; // Start after origin
        let totalDuration = 0;
        let totalDistance = 0;

        // Add points one by one
        while (visited.size < n) {
            let minDuration = Infinity;
            let nextIndex = null;

            for (let i = 0; i < n; i++) {
                if (!visited.has(i)) {
                    const duration = distanceMatrix[currentIndex !== null ? currentIndex + 1 : 0][i + 1]?.duration;
                    if (duration && duration < minDuration) {
                        minDuration = duration;
                        nextIndex = i;
                    }
                }
            }

            if (nextIndex === null) {
                // No valid next point, break to avoid infinite loop
                break;
            }

            waypointOrder.push(nextIndex);
            visited.add(nextIndex);
            if (currentIndex !== null) {
                totalDuration += distanceMatrix[currentIndex + 1][nextIndex + 1]?.duration || 0;
                totalDistance += distanceMatrix[currentIndex + 1][nextIndex + 1]?.distance || 0;
            }
            currentIndex = nextIndex;
        }

        // Add duration/distance from origin to first point
        if (waypointOrder.length > 0) {
            totalDuration += distanceMatrix[0][waypointOrder[0] + 1]?.duration || 0;
            totalDistance += distanceMatrix[0][waypointOrder[0] + 1]?.distance || 0;
        }

        return {
            waypointOrder,
            estimatedDuration: totalDuration,
            estimatedDistance: totalDistance
        };
    }

























    static async detectAnomalies(dataType, data, context = '', controller = new AbortController()) {
        try {
            logger.debug('Starting anomaly detection process');

            logger.debug('Validating dataType parameter');
            if (!dataType || typeof dataType !== 'string') {
                const error = new Error('Data type must be a non-empty string');
                error.status = 400;
                logger.debug(`Invalid dataType: ${dataType}`);
                throw error;
            }

            logger.debug('Validating data parameter');
            if (!Array.isArray(data) || data.length === 0) {
                const error = new Error('Data must be a non-empty array');
                error.status = 400;
                logger.debug('Invalid data: Data is not a non-empty array');
                throw error;
            }

            logger.debug('Initializing AI configuration');
            const aiConfig = await initializeAI();
            logger.debug('Retrieving AI configuration from database');
            const config = (await AIConfig.findOne()) || aiConfig;
            logger.debug(`Using configuration with anomalyThreshold: ${config.anomalyThreshold}`);

            logger.debug('Constructing prompt for AI analysis');
            const prompt = `Analyze the following data of type "${dataType}": ${JSON.stringify(data)}. ${context ? `Context: ${context}. ` : ''}Detect anomalies with a confidence threshold of ${config.anomalyThreshold}. For each anomaly, provide a detailed explanation including:
- Why it is considered an anomaly
- What might have caused it
- Where it occurred (e.g., specific field or record)
Return a JSON array of anomalies with their explanations, like this example:
[
  {"anomaly": 123, "explanation": "Value 123 is an outlier..."},
  {"anomaly": 456, "explanation": "Value 456 is unexpected..."}
]
Ensure the response is a valid JSON array with no extra text, comments, or formatting.`;
            logger.debug(`Generated prompt: ${prompt}`);

            logger.debug('Preparing API payload');
            const payload = {
                model: config.modelName || 'mistral',
                prompt,
                stream: false
            };
            logger.debug(`Payload prepared: ${JSON.stringify(payload)}`);

            logger.debug('Making API call to Ollama');
            const response = await makeOllamaApiCall('post', '/generate', payload, { signal: controller.signal });
            logger.debug('Received API response');

            logger.debug('Validating API response');
            if (!response || !response.response) {
                logger.debug('Invalid API response received');
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            logger.debug('Extracting and parsing JSON from response');
            let anomalies;
            try {
                const jsonString = this.extractJsonFromResponse(response.response);
                logger.debug(`Extracted JSON string: ${jsonString}`);
                anomalies = JSON.parse(jsonString);
                logger.debug(`Parsed anomalies: ${JSON.stringify(anomalies)}`);

                logger.debug('Validating parsed anomalies format');
                if (!Array.isArray(anomalies)) {
                    logger.debug('Anomalies is not an array');
                    throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
                }
                anomalies.forEach((anomaly, index) => {
                    if (!anomaly.anomaly || !anomaly.explanation) {
                        logger.debug(`Invalid anomaly at index ${index}: ${JSON.stringify(anomaly)}`);
                        throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
                    }
                });
            } catch (parseError) {
                logger.debug(`Failed to parse JSON: ${parseError.message}`);
                logger.warn('Returning empty array due to invalid JSON response');
                await NotificationService.triggerNotification({
                    event: 'ai:json_parse_failed',
                    data: { error: parseError.message, response: response.response },
                    metadata: { service: 'cron' }
                });
                return [];
            }

            logger.debug('Returning detected anomalies');
            return anomalies;
        } catch (error) {
            logger.debug(`Caught error: ${error.message}`);
            if (error.name === 'AbortError') {
                logger.debug('Request was aborted');
                const abortError = new Error(ERROR_MESSAGES.REQUEST_CANCELED);
                abortError.status = 499;
                throw abortError;
            }
            logger.debug('Throwing final error');
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(
                    new Error(
                        error.message === ERROR_MESSAGES.INVALID_AI_JSON
                            ? 'Invalid JSON response from AI service'
                            : ERROR_MESSAGES.AI_API_UNAVAILABLE
                    ),
                    { status: error.message === ERROR_MESSAGES.INVALID_AI_JSON ? 422 : 503 }
                );
        }
    }

    static extractJsonFromResponse(response) {
        // Normalize whitespace
        const normalized = response.replace(/\s+/g, ' ').trim();
        // Match all JSON objects
        const objectPattern = /\{[^}]*\}/g;
        const matches = normalized.match(objectPattern);
        if (!matches) {
            throw new Error('No valid JSON objects found in response');
        }
        // Wrap matches in an array
        const jsonString = `[${matches.join(',')}]`;
        return jsonString;
    }

    static async generateReport(filters, format, controller = new AbortController()) {
        try {
            if (!filters || typeof filters !== 'object') {
                const error = new Error(ERROR_MESSAGES.INVALID_FILTERS);
                error.status = 400;
                throw error;
            }

            const validFormats = ['pdf', 'excel', 'json'];
            if (!format || !validFormats.includes(format)) {
                const error = new Error(ERROR_MESSAGES.INVALID_FORMAT);
                error.status = 400;
                throw error;
            }

            const aiConfig = await initializeAI();
            const prompt = `Generate a comprehensive and precise ${filters.reportType} report based on the provided dataset: ${JSON.stringify(filters.data, null, 2)}. Your task is to deliver a professional analysis that includes:

- **Key Metrics**: Identify and explain the most critical metrics, including their values and significance to the ${filters.reportType} context.
- **Trends and Patterns**: Analyze the data to detect notable trends, patterns, or shifts, and describe their relevance.
- **Implications and Recommendations**: Provide actionable insights or recommendations based on the analysis, highlighting potential impacts or next steps.
- **Anomalies and Outliers**: Identify any unusual data points or anomalies, and explain their potential causes or implications.

Ensure the response is structured as a JSON object with a single 'summary' field containing the detailed analysis as a string. The summary should be clear, concise, and professionally written, avoiding jargon unless necessary and ensuring relevance to the ${filters.reportType} report. Return only the JSON object, with no additional text, comments, or formatting.`;


            const payload = {
                model: aiConfig.modelName || 'mistral',
                prompt,
                stream: false
            };

            const response = await makeOllamaApiCall('post', '/generate', payload, { signal: controller.signal });

            if (!response || !response.response) {
                throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
            }

            let report;
            try {
                const jsonString = this.extractJsonFromResponseReport(response.response);
                report = JSON.parse(jsonString);
                if (!report.summary || typeof report.summary !== 'string') {
                    throw new Error('Invalid summary format');
                }
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


    static extractJsonFromResponseReport(response) {
        const normalized = response.replace(/\s+/g, ' ').trim();
        const jsonMatch = normalized.match(/(\[.*?\]|\{.*?\})/);
        if (!jsonMatch) {
            logger.error('No valid JSON found in response', { response });
            throw new Error('No valid JSON object found in response');
        }
        return jsonMatch[0];
    }





    static async createAIConfig(configData, requesterId) {
        try {
            const requester = await User.findByPk(requesterId, {
                attributes: ['userID'],
                include: [{
                    model: Role,
                    attributes: ['name'],
                    through: { attributes: [] }
                }]
            });
            if (!requester || !requester.Roles.some(role => ['Admin', 'Super Admin'].includes(role.name))) {
                throw Object.assign(new Error(ERROR_MESSAGES.UNAUTHORIZED), { status: 403 });
            }

            const { modelName, maxOptimizeRoute, timesheetMaxSuggestions, supervisorId } = configData;

            if (supervisorId) {
                const supervisor = await User.findByPk(supervisorId, { attributes: ['userID'] });
                if (!supervisor) {
                    throw Object.assign(new Error(ERROR_MESSAGES.INVALID_SUPERVISOR), { status: 400 });
                }
            }

            if (!modelName || typeof modelName !== 'string') {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_MODEL_NAME), { status: 400 });
            }

            if (!Number.isInteger(maxOptimizeRoute) || maxOptimizeRoute <= 0) {
                throw Object.assign(new Error('Invalid maxOptimizeRoute value'), { status: 400 });
            }

            if (!Number.isInteger(timesheetMaxSuggestions) || timesheetMaxSuggestions <= 0) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_MAX_SUGGESTIONS), { status: 400 });
            }

            if (supervisorId) {
                const existingConfig = await AIConfig.findOne({ where: { supervisorId } });
                if (existingConfig) {
                    throw Object.assign(new Error('AI configuration already exists for this supervisor'), { status: 400 });
                }
            }

            const newConfig = await AIConfig.create({
                modelName,
                maxOptimizeRoute,
                timesheetMaxSuggestions,
                supervisorId: supervisorId || null
            });

            return {
                configID: newConfig.configID,
                modelName: newConfig.modelName,
                maxOptimizeRoute: newConfig.maxOptimizeRoute,
                timesheetMaxSuggestions: newConfig.timesheetMaxSuggestions,
                supervisorId: newConfig.supervisorId,
                createdAt: newConfig.createdAt,
                updatedAt: newConfig.updatedAt
            };
        } catch (error) {
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.INVALID_AI_CONFIG), { status: 400, details: error.message });
        }
    }

    static async updateAIConfig(configID, updateData, requesterId) {
        try {
            const requester = await User.findByPk(requesterId, {
                attributes: ['userID'],
                include: [{
                    model: Role,
                    attributes: ['name'],
                    through: { attributes: [] }
                }]
            });
            if (!requester || !requester.Roles.some(role => ['Admin', 'Super Admin'].includes(role.name))) {
                throw Object.assign(new Error(ERROR_MESSAGES.UNAUTHORIZED), { status: 403 });
            }

            const config = await AIConfig.findByPk(configID);
            if (!config) {
                throw Object.assign(new Error(ERROR_MESSAGES.AI_CONFIG_NOT_FOUND), { status: 404 });
            }

            const { modelName, maxOptimizeRoute, timesheetMaxSuggestions } = updateData;

            if (modelName && typeof modelName !== 'string') {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_MODEL_NAME), { status: 400 });
            }

            if (maxOptimizeRoute !== undefined && (!Number.isInteger(maxOptimizeRoute) || maxOptimizeRoute <= 0)) {
                throw Object.assign(new Error('Invalid maxOptimizeRoute value'), { status: 400 });
            }

            if (timesheetMaxSuggestions !== undefined && (!Number.isInteger(timesheetMaxSuggestions) || timesheetMaxSuggestions <= 0)) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_MAX_SUGGESTIONS), { status: 400 });
            }

            await config.update({
                modelName: modelName || config.modelName,
                maxOptimizeRoute: maxOptimizeRoute !== undefined ? maxOptimizeRoute : config.maxOptimizeRoute,
                timesheetMaxSuggestions: timesheetMaxSuggestions !== undefined ? timesheetMaxSuggestions : config.timesheetMaxSuggestions
            });

            return {
                configID: config.configID,
                modelName: config.modelName,
                maxOptimizeRoute: config.maxOptimizeRoute,
                timesheetMaxSuggestions: config.timesheetMaxSuggestions,
                supervisorId: config.supervisorId,
                createdAt: config.createdAt,
                updatedAt: config.updatedAt
            };
        } catch (error) {
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.INVALID_AI_CONFIG), { status: 400, details: error.message });
        }
    }

    static async getAIConfig(params, requesterId) {
        try {
            const requester = await User.findByPk(requesterId, { attributes: ['userID', 'role'] });
            if (!requester || !['Admin', 'Super Admin'].includes(requester.role)) {
                throw Object.assign(new Error(ERROR_MESSAGES.UNAUTHORIZED), { status: 403 });
            }

            const { configID, supervisorId } = params;

            let config;
            if (configID) {
                config = await AIConfig.findByPk(configID);
            } else if (supervisorId) {
                config = await AIConfig.findOne({ where: { supervisorId } });
            } else {
                config = await AIConfig.findOne({ where: { supervisorId: null } });
            }

            if (!config) {
                throw Object.assign(new Error(ERROR_MESSAGES.AI_CONFIG_NOT_FOUND), { status: 404 });
            }

            return {
                configID: config.configID,
                modelName: config.modelName,
                maxOptimizeRoute: config.maxOptimizeRoute,
                timesheetMaxSuggestions: config.timesheetMaxSuggestions,
                supervisorId: config.supervisorId,
                createdAt: config.createdAt,
                updatedAt: config.updatedAt
            };
        } catch (error) {
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_CONFIG_NOT_FOUND), { status: 404, details: error.message });
        }
    }

    static async listAIConfigs(params, requesterId) {
        try {
            const requester = await User.findByPk(requesterId, {
                attributes: ['userID'],
                include: [{
                    model: Role,
                    attributes: ['name'],
                    through: { attributes: [] }
                }]
            });
            if (!requester || !requester.Roles.some(role => ['Admin', 'Super Admin'].includes(role.name))) {
                throw Object.assign(new Error(ERROR_MESSAGES.UNAUTHORIZED), { status: 403 });
            }

            const { supervisorId } = params;
            const where = supervisorId ? { supervisorId } : {};
            const configs = await AIConfig.findAll({ where });
            return configs.map(config => ({
                configID: config.configID,
                modelName: config.modelName,
                maxOptimizeRoute: config.maxOptimizeRoute,
                timesheetMaxSuggestions: config.timesheetMaxSuggestions,
                supervisorId: config.supervisorId,
                createdAt: config.createdAt,
                updatedAt: config.updatedAt
            }));
        } catch (error) {
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error('Failed to list AI configurations'), { status: 500, details: error.message });
        }
    }

    static async deleteAIConfig(configID, requesterId) {
        try {
            // Validate requester
            const requester = await User.findByPk(requesterId, {
                attributes: ['userID'],
                include: [{
                    model: Role,
                    attributes: ['name'],
                    through: { attributes: [] }
                }]
            });
            if (!requester || !requester.Roles.some(role => ['Admin', 'Super Admin'].includes(role.name))) {
                throw Object.assign(new Error(ERROR_MESSAGES.UNAUTHORIZED), { status: 403 });
            }

            const config = await AIConfig.findByPk(configID);
            if (!config) {
                throw Object.assign(new Error(ERROR_MESSAGES.AI_CONFIG_NOT_FOUND), { status: 404 });
            }

            await config.destroy();
            return { message: 'AI configuration deleted successfully', configID };
        } catch (error) {
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_CONFIG_NOT_FOUND), { status: 404, details: error.message });
        }
    }

    static async testAIConfig(configID, requesterId) {
        try {

            const requester = await User.findByPk(requesterId, {
                attributes: ['userID'],
                include: [{
                    model: Role,
                    attributes: ['name'],
                    through: { attributes: [] }
                }]
            });

            if (!requester || !requester.Roles.some(role => ['Admin', 'Super Admin'].includes(role.name))) {
                throw Object.assign(new Error(ERROR_MESSAGES.UNAUTHORIZED), { status: 403 });
            }

            const config = await AIConfig.findByPk(configID);

            if (!config) {
                throw Object.assign(new Error(ERROR_MESSAGES.AI_CONFIG_NOT_FOUND), { status: 404 });
            }

            const testPrompt = `Test prompt for AI configuration ${configID}. Return a simple JSON object: {"status": "success"}`;
            const payload = {
                model: config.modelName,
                prompt: testPrompt,
                stream: false
            };

            const response = await makeOllamaApiCall('post', '/generate', payload);

            if (!response || !response.response) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE), { status: 503 });
            }

            let result;
            try {
                const jsonString = this.extractJsonFromResponse(response.response);
                result = JSON.parse(jsonString);
            } catch (parseError) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_AI_JSON), { status: 503, details: parseError.message });
            }

            return { configID, status: 'success', response: result };
        } catch (error) {
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503, details: error.message });
        }
    }





}

module.exports = AIService;