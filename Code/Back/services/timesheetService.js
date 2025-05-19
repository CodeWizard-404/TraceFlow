const { Timesheet, Visit, Agent, User, Delegation, Reason } = require('../models');
const AIService = require('./aiService');
const { sequelize } = require('../config/db');
const VisitService = require('./visitService');
const GoogleCalendarService = require('./googleCalendarService');
const { Op } = require('sequelize');

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
    static async listTimesheets() {
        try {
            return await Timesheet.findAll({
                include: [
                    {
                        model: Visit,
                        include: [
                            {
                                model: Reason,
                                attributes: ['reasonID', 'item'], // Only include reasonID and item
                                through: { attributes: [] }, // Exclude VisitReasons junction table data
                            },
                            { model: Agent },
                        ],
                    },
                    { model: User },
                ],
            });
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
                        ],
                    },
                    { model: User },
                ],
            })
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
                                attributes: ['reasonID', 'item'], // Only include reasonID and item
                                through: { attributes: [] }, // Exclude VisitReasons junction table data
                            },
                            { model: Agent },
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

    //get Timesheet by week number and year
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
            const reloadedTimesheet = await Timesheet.findByPk(timesheet.timesheetID, { include: [Visit, User] });

            let warning = null;
            try {
                const syncResults = await GoogleCalendarService.syncTimesheetToCalendar(actorID, timesheet.timesheetID);
                await GoogleCalendarService.notifyCalendarUpdate(actorID, {
                    timesheetId: timesheet.timesheetID,
                    syncedVisits: syncResults,
                    action: 'synced',
                });
            } catch (error) {
                warning = 'Timesheet created successfully, but Google Calendar sync failed.';
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

    static async validateTimesheet(id, visitIDs, status, actorID) {
        const transaction = await sequelize.transaction();
        try {
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
            return await Timesheet.findByPk(id, { include: [Visit, User] });
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