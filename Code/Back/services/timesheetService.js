// timesheetService.js
const { Timesheet, Visit, Agent, User, Delegation } = require('../models');
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
};

// Store active controllers for cancellation
const activeControllers = new Map();

class TimesheetService {
    static async listTimesheets() {
        try {
            return await Timesheet.findAll({ include: [Visit, User] });
        } catch (error) {
            throw Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

    static async viewTimesheet(id) {
        try {
            const timesheet = await Timesheet.findByPk(id, { include: [Visit, User] });
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
                include: [Visit, User],
            });
            return timesheets;
        } catch (error) {
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

    static async createTimesheet(data, actorID) {
        const transaction = await sequelize.transaction();
        try {
            const { weekNumber, year, supervisorID, visits, status } = data;
            const supervisor = await User.findByPk(supervisorID, { transaction });
            if (!supervisor) {
                const error = new Error(ERROR_MESSAGES.INVALID_SUPERVISOR);
                error.status = 404;
                throw error;
            }
            const timesheet = await Timesheet.create(
                {
                    weekNumber,
                    year,
                    supervisorID,
                    status,
                },
                { transaction }
            );


            if (visits && Array.isArray(visits) && visits.length > 0) {
                const visitPromises = visits.map(async (visit, index) => {
                    try {
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
                    } catch (error) {
                        throw error;
                    }
                });
                await Promise.all(visitPromises);
            }

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

    /**
     * Generate timesheet suggestions and store the AbortController.
     * @param {string} supervisorId - Supervisor ID.
     * @param {number} weekNumber - Week number.
     * @param {number} year - Year.
     * @param {Object} criteria - Criteria for suggestions.
     * @returns {Object} Object containing suggestions and requestId.
     */
    static async suggestTimesheet(supervisorId, weekNumber, year, criteria) {
        try {
            const supervisor = await User.findByPk(supervisorId);
            if (!supervisor) {
                const error = new Error(ERROR_MESSAGES.INVALID_SUPERVISOR);
                error.status = 404;
                throw error;
            }

            // Validate weekNumber and year
            if (!weekNumber || weekNumber < 1 || weekNumber > 53 || !year || year < 2000 || year > 2100) {
                const error = new Error(ERROR_MESSAGES.INVALID_WEEK_NUMBER);
                error.status = 400;
                throw error;
            }

            // Extract and validate criteria
            const {
                delegationIds = [],
                agentIds = [],
                preferredDays = [],
                supervisorLocation = { latitude: 36.8065, longitude: 10.1815 },
                timeInterval = { startHour: 8, endHour: 20 },
                maxVisitsPerAgentPerWeek = 1,
            } = criteria;

            // Validate time interval
            if (
                !Number.isInteger(timeInterval.startHour) ||
                !Number.isInteger(timeInterval.endHour) ||
                timeInterval.startHour < 0 ||
                timeInterval.endHour > 24 ||
                timeInterval.startHour >= timeInterval.endHour
            ) {
                const error = new Error('Invalid time interval provided.');
                error.status = 400;
                throw error;
            }

            // Validate delegationIds if provided
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

            // Fetch agents based on supervisorId, agentIds, or delegationIds
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
            if (agents.length === 0) {
                return { suggestions: [], requestId: null };
            }

            // Construct timesheetData for AI service
            const timesheetData = {
                delegationIds,
                agentIds,
                criteria: { ...criteria.filters },
                preferredDays,
                timeInterval,
                maxVisitsPerAgentPerWeek,
                supervisorLocation,
            };

            // Create AbortController and store it
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
                // Clean up controller after completion
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
     * Cancel a timesheet suggestion request.
     * @param {string} requestId - The ID of the request to cancel.
     * @returns {Promise<boolean>} True if canceled, false if request not found.
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