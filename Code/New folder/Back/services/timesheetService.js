const { Timesheet, Visit, Agent, User, Delegation, Reason, Checklist } = require('../models');
const AIService = require('./aiService');
const { sequelize } = require('../config/db');
const VisitService = require('./visitService');
const GoogleCalendarService = require('./googleCalendarService');
const GoogleMapsService = require('./googleMapsService');
const { Op } = require('sequelize');
const { nanoid } = require('nanoid');

const ERROR_MESSAGES = {
    INVALID_SUPERVISOR: 'Invalid supervisor ID.',
    INVALID_WEEK_NUMBER: 'Invalid week number or year.',
    DATABASE_ERROR: 'Database issue. Try again.',
    AI_API_UNAVAILABLE: 'AI service is unavailable. Try again later.',
    REQUEST_CANCELED: 'AI request was canceled.',
    MISSING_COORDINATES: 'Supervisor coordinates are required.',
    INVALID_TIME_INTERVAL: 'Valid time interval is required.',
};

const activeControllers = new Map();

class TimesheetService {
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
                            { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } },
                        ],
                    },
                    { model: User },
                ],
            });
            return timesheets;
        } catch (error) {
            throw Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

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
                            { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } },
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
            return timesheet;
        } catch (error) {
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

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
                            { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } },
                        ],
                    },
                    { model: User },
                ],
            });
            return timesheets;
        } catch (error) {
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

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
                            { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } },
                        ],
                    },
                    { model: User },
                ],
            });
            return timesheet;
        } catch (error) {
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

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
                            status: ['pending', 'visited', 'rejected', 'validated'].includes(visit.status)
                                ? visit.status
                                : 'pending',
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

            const reloadedTimesheet = await Timesheet.findByPk(timesheet.timesheetID, {
                include: [
                    {
                        model: Visit,
                        include: [
                            { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                            { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } },
                            { model: Agent },
                        ],
                    },
                    { model: User },
                ],
                transaction,
            });

            let warning = null;
            if (supervisor.hasCalendarAccess) {
                try {
                    const userId = supervisor.userID;
                    if (typeof userId !== 'string') {
                        throw new Error(`Invalid userId: ${userId}`);
                    }
                    const syncResults = await GoogleCalendarService.syncTimesheetToCalendar(userId, timesheet.timesheetID);
                    await GoogleCalendarService.notifyCalendarUpdate(userId, {
                        timesheetId: timesheet.timesheetID,
                        syncedVisits: syncResults,
                        action: 'synced',
                    });
                } catch (error) {
                    warning = `Timesheet ${timesheet.timesheetID} created successfully for user ${supervisor.userID}, but Google Calendar sync failed: ${error.message}`;
                }
            }

            await transaction.commit();
            return {
                timesheet: reloadedTimesheet,
                warning,
            };
        } catch (error) {
            await transaction.rollback();
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

    static async validateTimesheet(id, data, actorID) {
        const transaction = await sequelize.transaction();
        try {
            const { visitIDs, status } = data;
            const timesheet = await Timesheet.findByPk(id, {
                include: [
                    {
                        model: Visit,
                        include: [
                            { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                            { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } },
                            { model: Agent },
                        ],
                    },
                    { model: User },
                ],
                transaction,
            });
            if (!timesheet) {
                const error = new Error('Timesheet not found');
                error.status = 404;
                throw error;
            }
            if (!timesheet.User) {
                const error = new Error('Supervisor not found for timesheet');
                error.status = 500;
                throw error;
            }
            if (!['pending', 'visited', 'rejected', 'validated'].includes(status)) {
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
                    visit.status = status;
                    await visit.save({ transaction });
                }
            }
            timesheet.status = status;
            await timesheet.save({ transaction });

            let warning = null;
            if (timesheet.User.hasCalendarAccess) {
                try {
                    const userId = timesheet.User.userID;
                    if (typeof userId !== 'string') {
                        throw new Error(`Invalid userId: ${userId}`);
                    }
                    const syncResults = await GoogleCalendarService.syncTimesheetToCalendar(userId, id);
                    await GoogleCalendarService.notifyCalendarUpdate(userId, {
                        timesheetId: id,
                        syncedVisits: syncResults,
                        action: 'synced',
                    });
                } catch (error) {
                    warning = `Timesheet ${id} validated successfully for user ${timesheet.User.userID}, but Google Calendar sync failed: ${error.message}`;
                }
            }

            await transaction.commit();
            const updatedTimesheet = await Timesheet.findByPk(id, {
                include: [
                    {
                        model: Visit,
                        include: [
                            { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                            { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } },
                            { model: Agent },
                        ],
                    },
                    { model: User },
                ],
            });
            return {
                timesheet: updatedTimesheet,
                warning,
            };
        } catch (error) {
            await transaction.rollback();
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

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
                filters = {},
            } = criteria || {};

            if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
                const error = new Error(ERROR_MESSAGES.MISSING_COORDINATES);
                error.status = 400;
                throw error;
            }

            if (
                !timeInterval ||
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
                    filters,
                },
                preferredDays,
                timeInterval,
                maxVisitsPerAgentPerWeek,
                includeRecruitmentVisits,
                coordinates,
            };

            const controller = new AbortController();
            const requestId = `${supervisorId}-${weekNumber}-${year}-${Date.now()}`;
            activeControllers.set(requestId, controller);

            try {
                const aiSuggestions = await AIService.generateTimesheetSuggestions(
                    supervisorId,
                    weekNumber,
                    year,
                    timesheetData,
                    controller
                );

                const cleanedSuggestions = await this.cleanSuggestions(aiSuggestions, supervisorId, weekNumber, year, timesheetData);

                return { suggestions: cleanedSuggestions, requestId };
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

    static async cleanSuggestions(aiSuggestions, supervisorId, weekNumber, year, timesheetData) {
        try {
            const { timeInterval, preferredDays = [], includeRecruitmentVisits, coordinates } = timesheetData;

            const weekStart = AIService.getWeekStartDate(weekNumber, year);
            const validDates = preferredDays.length > 0
                ? preferredDays
                : Array.from({ length: 7 }, (_, i) => AIService.getDateString(weekStart, i));
            const today = new Date();
            const todayDate = today.toISOString().split('T')[0];
            const todayMinutes = (today.getUTCHours() + 1) * 60 + today.getUTCMinutes(); // CET

            const [reasons, checklists, agents] = await Promise.all([
                Reason.findAll({ attributes: ['reasonID', 'item'] }),
                Checklist.findAll({ attributes: ['checklistID', 'item'] }),
                Agent.findAll({
                    where: { supervisorID: supervisorId },
                    include: [{ model: Delegation, attributes: ['delegationID', 'name'] }],
                }),
            ]);

            const reasonMap = new Map(reasons.map(r => [r.reasonID, r]));
            const checklistMap = new Map(checklists.map(c => [c.checklistID, c]));
            const agentMap = new Map(agents.map(a => [a.agentID, a]));

            const validVisits = [];
            const timeToMinutes = (time) => {
                const [hours, minutes] = time.split(':').map(Number);
                return hours * 60 + minutes;
            };

            for (const visit of aiSuggestions) {
                if (!visit.date || !validDates.includes(visit.date) || visit.date < todayDate) {
                    continue;
                }

                const visitMinutes = visit.time ? timeToMinutes(visit.time) : null;
                if (
                    !visit.time ||
                    visitMinutes < timeInterval.startHour * 60 ||
                    visitMinutes >= timeInterval.endHour * 60 ||
                    (visit.date === todayDate && visitMinutes <= todayMinutes)
                ) {
                    continue;
                }

                const isRecruitment = includeRecruitmentVisits && visit.agentID === null;
                if (!isRecruitment && (!visit.agentID || !agentMap.has(visit.agentID))) {
                    continue;
                }

                const reasons = Array.isArray(visit.reasons)
                    ? visit.reasons.map(r => reasonMap.get(r.id) ? { id: r.id } : null).filter(r => r)
                    : [];
                const checklists = Array.isArray(visit.checklists)
                    ? visit.checklists.map(c => checklistMap.get(c.id) ? { id: c.id } : null).filter(c => c)
                    : [];

                // Allow recruitment visits with empty checklists but require at least one reason
                if (reasons.length === 0 || (!isRecruitment && checklists.length === 0)) {
                    continue;
                }

                const agent = visit.agentID ? agentMap.get(visit.agentID) : null;
                const location = isRecruitment
                    ? 'Recruitment Location'
                    : agent?.location?.match(/^-?\d+\.\d+,-?\d+\.\d+$/)
                        ? agent.Delegation?.name || 'Unknown Location'
                        : agent?.location || agent.Delegation?.name || 'Unknown Location';

                validVisits.push({
                    date: visit.date,
                    time: visit.time,
                    agentID: visit.agentID,
                    location,
                    latitude: agent?.latitude || null,
                    longitude: agent?.longitude || null,
                    reasons: reasons.map(r => ({ reasonID: r.id, item: reasonMap.get(r.id).item })),
                    checklists: checklists.map(c => ({ checklistID: c.id, item: checklistMap.get(c.id).item })),
                    agent,
                    status: 'pending',
                });
            }

            const visitTimesByDate = {};
            for (const visit of validVisits) {
                if (!visitTimesByDate[visit.date]) {
                    visitTimesByDate[visit.date] = new Set();
                }
                const visitMinutes = timeToMinutes(visit.time);
                let isDuplicate = false;
                for (const existingMinutes of visitTimesByDate[visit.date]) {
                    if (Math.abs(visitMinutes - existingMinutes) < 60) {
                        validVisits.splice(validVisits.indexOf(visit), 1);
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    visitTimesByDate[visit.date].add(visitMinutes);
                }
            }

            return validVisits.map(visit => ({
                visitID: `vis_suggested_${nanoid()}`,
                date: visit.date,
                time: visit.time,
                location: visit.location,
                status: visit.status,
                photos: [],
                comment: null,
                agentID: visit.agentID,
                timesheetID: `ts_suggested_${nanoid()}`,
                calendarEventId: null,
                Reasons: visit.reasons,
                Checklists: visit.checklists,
                Agent: visit.agent
                    ? {
                        agentID: visit.agent.agentID,
                        name: visit.agent.name,
                        lastname: visit.agent.lastname,
                        email: visit.agent.email,
                        phone: visit.agent.phone,
                        location: visit.agent.location,
                        latitude: visit.agent.latitude,
                        longitude: visit.agent.longitude,
                        supervisorID: visit.agent.supervisorID,
                        delegationID: visit.agent.delegationID,
                        Delegation: visit.agent.Delegation,
                    }
                    : null,
            }));
        } catch (error) {
            throw Object.assign(new Error('Failed to clean suggestions: ' + error.message), { status: 500 });
        }
    }

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