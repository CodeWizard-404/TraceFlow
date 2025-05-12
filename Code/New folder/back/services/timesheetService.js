const { Timesheet, Visit, Agent, User } = require('../models');
const AIService = require('./aiService');
const logger = require('../utils/logger');
const { sequelize } = require('../config/db');

const ERROR_MESSAGES = {
    INVALID_SUPERVISOR: 'Invalid supervisor ID.',
    INVALID_WEEK_START: 'Invalid week start date.',
    DATABASE_ERROR: 'Database issue. Try again.',
    AI_API_UNAVAILABLE: 'AI service is unavailable. Try again later.',
};

class TimesheetService {
    static async listTimesheets() {
        try {
            return await Timesheet.findAll({ include: [Visit, User] });
        } catch (error) {
            logger.error('Failed to list timesheets', { error: error.message, service: 'timesheet' });
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
            logger.error('Failed to fetch timesheet', { error: error.message, service: 'timesheet', metadata: { id } });
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
            logger.error('Failed to fetch timesheets by supervisor', {
                error: error.message,
                service: 'timesheet',
                metadata: { supervisorID },
            });
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
            if (visits && visits.length > 0) {
                const visitPromises = visits.map(async (visit) => {
                    return await Visit.create(
                        {
                            ...visit,
                            timesheetID: timesheet.timesheetID,
                            status: visit.status || 'pending',
                        },
                        { transaction }
                    );
                });
                await Promise.all(visitPromises);
            }
            await transaction.commit();
            return await Timesheet.findByPk(timesheet.timesheetID, { include: [Visit, User] });
        } catch (error) {
            await transaction.rollback();
            logger.error('Failed to create timesheet', {
                error: error.message,
                service: 'timesheet',
                metadata: { actorID },
            });
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
            logger.error('Failed to validate timesheet', {
                error: error.message,
                service: 'timesheet',
                metadata: { id, actorID },
            });
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.DATABASE_ERROR), { status: 500 });
        }
    }

    static async suggestTimesheet(supervisorId, weekStart, criteria) {
        try {
            const supervisor = await User.findByPk(supervisorId);
            if (!supervisor) {
                const error = new Error(ERROR_MESSAGES.INVALID_SUPERVISOR);
                error.status = 404;
                throw error;
            }
            if (!weekStart || isNaN(Date.parse(weekStart))) {
                const error = new Error(ERROR_MESSAGES.INVALID_WEEK_START);
                error.status = 400;
                throw error;
            }
            const agents = await Agent.findAll({ where: { supervisorID: supervisorId } });
            const agentData = agents.map(agent => ({
                agentID: agent.agentID,
                location: agent.location,
                weeklyTarget: agent.weeklyTarget || 0,
            }));
            const timesheetData = {
                supervisorId,
                weekStart,
                agentData,
                criteria: criteria || {},
            };
            const suggestions = await AIService.generateTimesheetSuggestions(supervisorId, weekStart, timesheetData);
            logger.info('Timesheet suggestions generated', {
                service: 'timesheet',
                metadata: { supervisorId, weekStart, suggestionCount: suggestions.length },
            });
            return suggestions;
        } catch (error) {
            logger.error('Failed to generate timesheet suggestions', {
                error: error.message,
                service: 'timesheet',
                metadata: { supervisorId, weekStart },
            });
            throw error.status ? error : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503 });
        }
    }
}

module.exports = TimesheetService;