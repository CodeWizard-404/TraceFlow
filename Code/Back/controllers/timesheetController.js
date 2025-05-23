const { validationResult } = require('express-validator');
const TimesheetService = require('../services/timesheetService');
const GoogleCalendarService = require('../services/googleCalendarService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { Timesheet, User } = require('../models');
const { Visit, Agent, Reason, Checklist } = require('../models');

const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    SERVER_ERROR: 'Something broke. Try again later.',
    INVALID_SUPERVISOR: 'Invalid supervisor ID.',
    INVALID_WEEK_START: 'Invalid week start date.',
    REQUEST_CANCELED: 'AI request was canceled.',
    INVALID_COORDINATES: 'Valid coordinates (lat, lng) are required.',
    INVALID_TIME_INTERVAL: 'Valid time interval (startHour, endHour) is required.',
};

class TimesheetController {
    static formatError(error) {
        return {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
        };
    }

    static async getAllTimesheets(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const timesheets = await TimesheetService.listTimesheets();
            logger.info('Successfully fetched all timesheets', {
                route: 'timesheets',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { timesheetCount: timesheets.length },
            });
            return res.status(200).json(timesheets);
        } catch (error) {
            const response = TimesheetController.formatError(error);
            logger.error('Failed to fetch all timesheets', {
                route: 'timesheets',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(500).json(response);
        }
    }

    static async getTimesheetById(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { id } = req.params;
            const timesheet = await TimesheetService.viewTimesheet(id);
            logger.info('Successfully fetched timesheet', {
                route: 'timesheets',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { timesheetID: id },
            });
            return res.status(200).json(timesheet);
        } catch (error) {
            const response = TimesheetController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logger.error('Failed to fetch timesheet', {
                route: 'timesheets',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async getTimesheetsBySupervisor(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { supervisorID } = req.params;
            const timesheets = await TimesheetService.getTimesheetsBySupervisor(supervisorID);
            logger.info('Successfully fetched timesheets by supervisor', {
                route: 'timesheets/supervisor',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { supervisorID, timesheetCount: timesheets.length },
            });
            return res.status(200).json(timesheets);
        } catch (error) {
            const response = TimesheetController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logger.error('Failed to fetch timesheets by supervisor', {
                route: 'timesheets/supervisor',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async getTimesheetByWeekNumberAndYear(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { weekNumber, year, supervisorID } = req.params;
            const timesheet = await TimesheetService.getTimesheetByWeekAndYear(weekNumber, year, supervisorID);
            logger.info('Successfully fetched timesheet by week number and year', {
                route: 'timesheets/weekNumberAndYear',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { weekNumber, year },
            });
            return res.status(200).json(timesheet);
        } catch (error) {
            const response = TimesheetController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logger.error('Failed to fetch timesheet by week number and year', {
                route: 'timesheets/weekNumberAndYear',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async createTimesheet(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { weekNumber, year, supervisorID, visits, status = 'pending' } = req.body;
            if (!['pending', 'visited', 'rejected', 'validated'].includes(status)) {
                throw new Error('Invalid status');
            }
            const result = await TimesheetService.createTimesheet({ weekNumber, year, supervisorID, visits, status }, actorID);

            const response = {
                timesheet: result.timesheet,
            };
            if (result.warning) {
                response.warning = result.warning;
            }

            await NotificationService.triggerNotification({
                event: 'timesheet:created',
                data: { timesheetId: result.timesheet.timesheetID, supervisorID, weekNumber, year, status },
                metadata: { createdBy: req.user.email },
            });

            logger.info('Successfully created timesheet', {
                route: 'timesheets',
                method: req.method,
                url: req.originalUrl,
                status: 201,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { timesheetID: result.timesheet.timesheetID, supervisorID, visitCount: visits ? visits.length : 0 },
            });

            return res.status(201).json(response);
        } catch (error) {
            const response = TimesheetController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS || error.message === 'Invalid status' ? 400 : error.status || 500;
            logger.error('Failed to create timesheet', {
                route: 'timesheets',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async validateTimesheet(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { id } = req.params;
            const { visitIDs = [], status } = req.body;
            if (!['pending', 'visited', 'rejected', 'validated'].includes(status)) {
                throw new Error('Invalid status');
            }
            const timesheet = await TimesheetService.validateTimesheet(id, { visitIDs, status }, actorID);

            try {
                const supervisor = await User.findByPk(timesheet.supervisorID);
                if (!supervisor) {
                    throw new Error('Supervisor not found');
                }
                const userId = supervisor.userID;
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
                logger.warn(`Failed to sync timesheet ${id} to calendar after validation: ${error.message}`, {
                    userId: timesheet.supervisorID,
                    timesheetId: id
                });
            }

            await NotificationService.triggerNotification({
                event: 'timesheet:validated',
                data: { timesheetId: id, status, supervisorID: timesheet.supervisorID },
                metadata: { validatedBy: req.user.email },
            });

            logger.info('Successfully validated timesheet', {
                route: 'timesheets/validate',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { timesheetID: id, status, visitCount: visitIDs.length },
            });

            return res.status(200).json(timesheet);
        } catch (error) {
            const response = TimesheetController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS || error.message === 'Invalid status' ? 400 : error.status || 500;
            logger.error('Failed to validate timesheet', {
                route: 'timesheets/validate',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async suggestTimesheet(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { supervisorID, weekNumber, year, coordinates } = req.body;
            const criteria = req.body.criteria || {};

            if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
                throw new Error(ERROR_MESSAGES.INVALID_COORDINATES);
            }

            const result = await TimesheetService.suggestTimesheet(supervisorID, weekNumber, year, criteria, coordinates);

            await NotificationService.triggerNotification({
                event: 'timesheet:suggested',
                data: { supervisorID, weekNumber, year, suggestionCount: result.suggestions.length },
                metadata: { suggestedBy: req.user.email },
            });

            logger.info('Successfully suggested timesheet', {
                route: 'timesheets/suggest',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { supervisorID, weekNumber, year, suggestionCount: result.suggestions.length },
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = TimesheetController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ||
                error.message === ERROR_MESSAGES.INVALID_COORDINATES ||
                error.message === ERROR_MESSAGES.REQUEST_CANCELED ? 400 : error.status || 500;
            logger.error('Failed to suggest timesheet', {
                route: 'timesheets/suggest',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async cancelTimesheetSuggestion(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { requestId } = req.params;
            const success = await TimesheetService.cancelTimesheetSuggestion(requestId);

            if (!success) {
                throw new Error('No active suggestion request found for the provided ID');
            }

            await NotificationService.triggerNotification({
                event: 'timesheet:suggestion_canceled',
                data: { requestId },
                metadata: { canceledBy: req.user.email },
            });

            logger.info('Successfully canceled timesheet suggestion', {
                route: 'timesheets/cancel-suggestion',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { requestId },
            });

            return res.status(200).json({ message: 'Timesheet suggestion request canceled successfully' });
        } catch (error) {
            const response = TimesheetController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logger.error('Failed to cancel timesheet suggestion', {
                route: 'timesheets/cancel-suggestion',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async syncTimesheetToCalendar(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            const timesheet = await Timesheet.findByPk(id, {
                include: [
                    {
                        model: Visit,
                        include: [
                            { model: Agent },
                            { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                            { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } },
                        ],
                    },
                    { model: User },
                ],
            });

            if (!timesheet) {
                logger.error(`Timesheet not found`, { timesheetId: id, userID: actorID });
                return res.status(404).json({ error: 'Timesheet not found' });
            }
            if (!timesheet.User) {
                logger.error(`User not found for timesheet`, { timesheetId: id, userID: actorID });
                return res.status(404).json({ error: 'User not found for this timesheet' });
            }

            const userId = timesheet.User.userID;
            if (typeof userId !== 'string') {
                logger.error(`Invalid userId type: expected string, got ${typeof userId}`, { userId, timesheetId: id });
                return res.status(500).json({ error: 'Invalid user ID type' });
            }

            const syncResults = await GoogleCalendarService.syncTimesheetToCalendar(userId, id);
            await GoogleCalendarService.notifyCalendarUpdate(userId, {
                timesheetId: id,
                syncedVisits: syncResults,
                action: 'synced',
            });

            await NotificationService.triggerNotification({
                event: 'timesheet:synced',
                data: { timesheetId: id, supervisorID: timesheet.supervisorID, syncedVisitCount: syncResults.length },
                metadata: { syncedBy: req.user.email },
            });

            logger.info('Successfully synced timesheet to calendar', {
                route: 'timesheets/sync',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { timesheetID: id, syncedVisitCount: syncResults.length },
            });

            return res.status(200).json({ timesheetId: id, syncedVisits: syncResults });
        } catch (error) {
            logger.error(`Sync timesheet to calendar error: ${error.message}`, {
                method: req.method,
                url: req.originalUrl,
                userId: actorID,
                timesheetId: req.params.id,
            });
            return res.status(500).json({ error: 'Failed to sync timesheet to calendar' });
        }
    }
}

module.exports = TimesheetController;