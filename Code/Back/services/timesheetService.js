const { Timesheet, Visit, Agent, User, Delegation, Reason } = require('../models');
const AIService = require('./aiService');
const { sequelize } = require('../config/db');
const VisitService = require('./visitService');
const GoogleCalendarService = require('./googleCalendarService');
const LocationService = require('./locationsService');
const GoogleMapsService = require('./googleMapsService');
const { Op } = require('sequelize');
const { getKeycloakAdminToken, getGoogleAccessTokenForUser } = require('../utils/tokenExchange');

const ERROR_MESSAGES = {
    INVALID_SUPERVISOR: 'Invalid supervisor ID.',
    INVALID_WEEK_NUMBER: 'Invalid week number or year.',
    DATABASE_ERROR: 'Database issue. Try again.',
    AI_API_UNAVAILABLE: 'AI service is unavailable. Try again later.',
    REQUEST_CANCELED: 'AI request was canceled.',
    MISSING_COORDINATES: 'Supervisor coordinates are required.',
    INVALID_TIME_INTERVAL: 'Valid time interval is required.'
};

const activeControllers = new Map();

class TimesheetService {
    /**
     * Enriches visits with an address attribute based on specified conditions.
     * @param {Array} timesheets - Array of timesheet objects containing visits.
     */
    static async enrichVisitsWithAddresses(timesheets) {
        const redisClient = GoogleMapsService.redisClient;
        for (const timesheet of timesheets) {
            for (const visit of timesheet.Visits || []) {
                let address;
                let cacheKey;

                // Case 1: Visit has an agentID
                if (visit.agentID) {
                    cacheKey = `agent:${visit.agentID}`;
                    address = await redisClient.get(cacheKey);
                    if (!address) {
                        try {
                            const agent = await Agent.findByPk(visit.agentID);
                            if (agent && agent.delegationID) {
                                const response = await LocationService.getLocationById(agent.delegationID);
                                address = response.success ? response.address : 'N/A';
                                await redisClient.set(cacheKey, address);
                            } else {
                                console.error(`Agent not found or missing delegationID for agentID: ${visit.agentID}`);
                                address = 'N/A';
                            }
                        } catch (error) {
                            console.error(`Failed to fetch address for agentID ${visit.agentID}:`, error);
                            address = 'N/A';
                        }
                    }
                }
                // Case 2: Visit has a location that's coordinates
                else if (visit.location && this.isCoordinates(visit.location)) {
                    cacheKey = `coords:${visit.location}`;
                    address = await redisClient.get(cacheKey);
                    if (!address) {
                        try {
                            const [lat, lng] = visit.location.split(',').map(Number);
                            const geocode = await GoogleMapsService.reverseGeocode(lat, lng);
                            address = geocode.formattedAddress || 'N/A';
                            await redisClient.set(cacheKey, address);
                        } catch (error) {
                            console.error(`Failed to reverse geocode coordinates ${visit.location}:`, error);
                            address = 'N/A';
                        }
                    }
                }
                // Case 3: Visit has a location that's not coordinates
                else if (visit.location) {
                    cacheKey = `direct:${visit.location}`;
                    address = visit.location;
                    await redisClient.set(cacheKey, address);
                }
                // Case 4: No agentID or location
                else {
                    address = 'N/A';
                }

                // Add the address attribute to the visit
                visit.address = address;
            }
        }
    }

    /**
     * Checks if a string represents coordinates (e.g., "12.34, 56.78").
     * @param {string} str - The string to check.
     * @returns {boolean} - True if the string is coordinates, false otherwise.
     */
    static isCoordinates(str) {
        return /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/.test(str);
    }

    /**
     * Fetches all timesheets with enriched visit addresses.
     * @returns {Promise<Array>} - Array of timesheets.
     */
    static async listTimesheets() {
        try {
            const timesheets = await Timesheet.findAll({
                include: [
                    {
                        model: Visit,
                        include: [
                            {
                                model: Reason,
                                attributes: ['reasonID', 'item'],
                                through: { attributes: [] },
                            },
                            { model: Agent },
                        ],
                    },
                    { model: User },
                ],
            });
            await this.enrichVisitsWithAddresses(timesheets);
            return timesheets;
        } catch (error) {
            throw Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

    /**
     * Fetches a single timesheet by ID with enriched visit addresses.
     * @param {string} id - Timesheet ID.
     * @returns {Promise<Object>} - Timesheet object.
     */
    static async viewTimesheet(id) {
        try {
            const timesheet = await Timesheet.findByPk(id, {
                include: [
                    {
                        model: Visit,
                        include: [
                            {
                                model: Reason,
                                attributes: ['reasonID', 'item'],
                                through: { attributes: [] },
                            },
                            { model: Agent },
                        ],
                    },
                    { model: User },
                ],
            });
            if (!timesheet) {
                const error = new Error('Timesheet not found');
                error.status = 404;
                throw error;
            }
            await this.enrichVisitsWithAddresses([timesheet]);
            return timesheet;
        } catch (error) {
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

    /**
     * Fetches timesheets by supervisor ID with enriched visit addresses.
     * @param {string} supervisorID - Supervisor ID.
     * @returns {Promise<Array>} - Array of timesheets.
     */
    static async getTimesheetsBySupervisor(supervisorID) {
        try {
            const timesheets = await Timesheet.findAll({
                where: { supervisorID },
                include: [
                    {
                        model: Visit,
                        include: [
                            {
                                model: Reason,
                                attributes: ['reasonID', 'item'],
                                through: { attributes: [] },
                            },
                            { model: Agent },
                        ],
                    },
                    { model: User },
                ],
            });
            await this.enrichVisitsWithAddresses(timesheets);
            return timesheets;
        } catch (error) {
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

    /**
     * Fetches a timesheet by week number, year, and supervisor ID with enriched visit addresses.
     * @param {number} weekNumber - Week number.
     * @param {number} year - Year.
     * @param {string} supervisorID - Supervisor ID.
     * @returns {Promise<Object|null>} - Timesheet object or null.
     */
    static async getTimesheetByWeekAndYear(weekNumber, year, supervisorID) {
        try {
            const timesheet = await Timesheet.findOne({
                where: { weekNumber, year, supervisorID },
                include: [
                    {
                        model: Visit,
                        include: [
                            {
                                model: Reason,
                                attributes: ['reasonID', 'item'],
                                through: { attributes: [] },
                            },
                            { model: Agent },
                        ],
                    },
                    { model: User },
                ],
            });
            if (timesheet) {
                await this.enrichVisitsWithAddresses([timesheet]);
            }
            return timesheet;
        } catch (error) {
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

    /**
     * Creates a new timesheet and enriches visits with addresses.
     * @param {Object} data - Timesheet data.
     * @param {string} actorID - Actor ID.
     * @returns {Promise<Object>} - Created timesheet and optional warning.
     */
    static async createTimesheet(data, actorID) {
        const transaction = await sequelize.transaction();
        try {
            const { weekNumber, year, supervisorID, visits, status = 'pending' } = data;
            const supervisor = await User.findByPk(supervisorID, { transaction });
            if (!supervisor) {
                const error = new Error(ERROR_MESSAGES.INVALID_SUPERVISOR);
                error.status = 404;
                throw error;
            }

            let timesheet = await Timesheet.findOne({
                where: { weekNumber, year, supervisorID },
                include: [{ model: Visit }],
                transaction,
            });

            if (!timesheet) {
                try {
                    timesheet = await Timesheet.create(
                        {
                            weekNumber,
                            year,
                            supervisorID,
                            status,
                        },
                        { transaction }
                    );
                } catch (error) {
                    if (error.name === 'SequelizeUniqueConstraintError') {
                        timesheet = await Timesheet.findOne({
                            where: { weekNumber, year, supervisorID },
                            include: [{ model: Visit }],
                            transaction,
                        });
                        if (!timesheet) {
                            throw new Error('Failed to find or create timesheet after unique constraint error');
                        }
                    } else {
                        throw error;
                    }
                }
            }

            if (visits && Array.isArray(visits) && visits.length > 0) {
                const visitPromises = visits.map(async (visit) => {
                    return await VisitService.createVisit(
                        {
                            ...visit,
                            timesheetID: timesheet.timesheetID,
                            supervisorID,
                            status: visit.status || 'pending',
                        },
                        actorID,
                        { transaction }
                    );
                });
                await Promise.all(visitPromises);
            }

            const timesheetWithVisits = await Timesheet.findByPk(timesheet.timesheetID, {
                include: [{ model: Visit }],
                transaction,
            });
            const visitStatuses = timesheetWithVisits.Visits.map((v) => v.status);
            const uniqueStatuses = [...new Set(visitStatuses)];
            timesheetWithVisits.status = uniqueStatuses.length > 1 ? 'pending' : uniqueStatuses[0] || status;
            await timesheetWithVisits.save({ transaction });

            await transaction.commit();
            const reloadedTimesheet = await Timesheet.findByPk(timesheet.timesheetID, {
                include: [Visit, User]
            });
            await this.enrichVisitsWithAddresses([reloadedTimesheet]);

            let warning = null;
            try {
                const adminToken = await getKeycloakAdminToken();
                const googleToken = await getGoogleAccessTokenForUser(supervisor.keycloakId, adminToken);
                const syncResults = await GoogleCalendarService.syncTimesheetToCalendar(googleToken, timesheet.timesheetID);
                await GoogleCalendarService.notifyCalendarUpdate(supervisor.keycloakId, {
                    timesheetId: timesheet.timesheetID,
                    syncedVisits: syncResults,
                    action: 'synced',
                });
            } catch (error) {
                warning = 'Timesheet created successfully, but Google Calendar sync failed.';
                console.error(`Failed to sync timesheet ${timesheet.timesheetID} to Google Calendar: ${error.message}`);
            }

            return {
                timesheet: reloadedTimesheet,
                warning,
            };
        } catch (error) {
            await transaction.rollback();
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

    /**
     * Validates a timesheet and enriches visits with addresses.
     * @param {string} id - Timesheet ID.
     * @param {Object} data - Validation data.
     * @param {string} actorID - Actor ID.
     * @returns {Promise<Object>} - Updated timesheet.
     */
    static async validateTimesheet(id, data, actorID) {
        const transaction = await sequelize.transaction();
        try {
            const { visitIDs, status } = data;
            const timesheet = await Timesheet.findByPk(id, { include: [Visit], transaction });
            if (!timesheet) {
                const error = new Error('Timesheet not found');
                error.status = 404;
                throw error;
            }
            if (!['pending', 'validated'].includes(status)) {
                const error = new Error('Invalid status');
                error.status = 400;
                throw error;
            }
            if (visitIDs.length > 0) {
                const visits = await Visit.findAll({
                    where: { visitID: visitIDs, timesheetID: id },
                    transaction,
                });
                if (visits.length !== visitIDs.length) {
                    const error = new Error('Some visits not found or do not belong to this timesheet');
                    error.status = 400;
                    throw error;
                }
                for (const visit of visits) {
                    visit.status = status === 'validated' ? 'validated' : 'pending';
                    await visit.save({ transaction });
                }
            }
            timesheet.status = status;
            await timesheet.save({ transaction });
            await transaction.commit();
            const updatedTimesheet = await Timesheet.findByPk(id, { include: [Visit, User] });
            await this.enrichVisitsWithAddresses([updatedTimesheet]);
            return updatedTimesheet;
        } catch (error) {
            await transaction.rollback();
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

    /**
     * Suggests a timesheet (no address enrichment needed here).
     * @param {string} supervisorId - Supervisor ID.
     * @param {number} weekNumber - Week number.
     * @param {number} year - Year.
     * @param {Object} criteria - Suggestion criteria.
     * @param {Object} coordinates - Coordinates.
     * @returns {Promise<Object>} - Suggestions and request ID.
     */
    static async suggestTimesheet(supervisorId, weekNumber, year, criteria, coordinates) {
        try {
            const supervisor = await User.findByPk(supervisorId);
            if (!supervisor) {
                const error = new Error(ERROR_MESSAGES.INVALID_SUPERVISOR);
                error.status = 404;
                throw error;
            }

            if (!weekNumber || weekNumber < 1 || weekNumber > 53 || !year || year < 2000 || year > 2100) {
                const error = new Error(ERROR_MESSAGES.INVALID_WEEK_NUMBER);
                error.status = 400;
                throw error;
            }

            const {
                delegationIds = [],
                agentIds = [],
                preferredDays = [],
                timeInterval,
                maxVisitsPerAgentPerWeek = 1,
                includeRecruitmentVisits = false,
                recruitmentAreas = [],
                description = '',
                filters = {}
            } = criteria || {};

            if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
                const error = new Error(ERROR_MESSAGES.MISSING_COORDINATES);
                error.status = 400;
                throw error;
            }

            if (!timeInterval || !Number.isInteger(timeInterval.startHour) || !Number.isInteger(timeInterval.endHour) ||
                timeInterval.startHour < 0 || timeInterval.endHour > 24 || timeInterval.startHour >= timeInterval.endHour) {
                const error = new Error(ERROR_MESSAGES.INVALID_TIME_INTERVAL);
                error.status = 400;
                throw error;
            }

            if (delegationIds.length > 0) {
                const delegations = await Delegation.findAll({
                    where: { delegationID: { [Op.in]: delegationIds } },
                });
                if (delegations.length !== delegationIds.length) {
                    const error = new Error('Invalid delegation IDs provided.');
                    error.status = 400;
                    throw error;
                }
            }

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

            const timesheetData = {
                delegationIds,
                agentIds,
                criteria: {
                    recruitmentAreas: includeRecruitmentVisits ? recruitmentAreas : [],
                    description,
                    filters
                },
                preferredDays,
                timeInterval,
                maxVisitsPerAgentPerWeek,
                includeRecruitmentVisits,
                coordinates
            };

            const controller = new AbortController();
            const requestId = `${supervisorId}-${weekNumber}-${year}-${Date.now()}`;
            activeControllers.set(requestId, controller);

            try {
                const suggestions = await AIService.generateTimesheetSuggestions(
                    supervisorId,
                    weekNumber,
                    year,
                    timesheetData,
                    controller
                );
                return { suggestions, requestId };
            } finally {
                activeControllers.delete(requestId);
            }
        } catch (error) {
            if (error.message === ERROR_MESSAGES.REQUEST_CANCELED) {
                throw error;
            }
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503 });
        }
    }

    /**
     * Cancels a timesheet suggestion request.
     * @param {string} requestId - Request ID.
     * @returns {Promise<boolean>} - Success status.
     */
    static async cancelTimesheetSuggestion(requestId) {
        const controller = activeControllers.get(requestId);
        if (controller) {
            controller.abort();
            activeControllers.delete(requestId);
            return true;
        }
        return false;
    }
}

module.exports = TimesheetService;