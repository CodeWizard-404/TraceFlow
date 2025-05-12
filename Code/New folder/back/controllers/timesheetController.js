const { validationResult } = require('express-validator');
const TimesheetService = require('../services/timesheetService');
const GoogleCalendarService = require('../services/googleCalendarService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    SERVER_ERROR: 'Something broke. Try again later.',
    INVALID_SUPERVISOR: 'Invalid supervisor ID.',
    INVALID_WEEK_START: 'Invalid week start date.',
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

    static async createTimesheet(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { weekNumber, year, supervisorID, visits, status = 'pending' } = req.body;
            const timesheet = await TimesheetService.createTimesheet({ weekNumber, year, supervisorID, visits, status }, actorID);
            try {
                const syncResults = await GoogleCalendarService.syncTimesheetToCalendar(req.user.userID, timesheet.timesheetID);
                await GoogleCalendarService.notifyCalendarUpdate(req.user.userID, {
                    timesheetId: timesheet.timesheetID,
                    syncedVisits: syncResults,
                    action: 'synced',
                });
            } catch (error) {
                logger.warn(`Failed to sync timesheet ${timesheet.timesheetID} to calendar: ${error.message}`);
            }
            await NotificationService.triggerNotification({
                event: 'timesheet:created',
                data: { timesheetId: timesheet.timesheetID, supervisorID, weekNumber, year },
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
                metadata: { timesheetID: timesheet.timesheetID, supervisorID, visitCount: visits.length },
            });
            return res.status(201).json(timesheet);
        } catch (error) {
            const response = TimesheetController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
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
            const timesheet = await TimesheetService.validateTimesheet(id, visitIDs, status, actorID);
            try {
                const syncResults = await GoogleCalendarService.syncTimesheetToCalendar(req.user.userID, id);
                await GoogleCalendarService.notifyCalendarUpdate(req.user.userID, {
                    timesheetId: id,
                    syncedVisits: syncResults,
                    action: 'synced',
                });
            } catch (error) {
                logger.warn(`Failed to sync timesheet ${id} to calendar after validation: ${error.message}`);
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
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
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

    static async syncTimesheetToCalendar(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { id } = req.params;
            const syncResults = await GoogleCalendarService.syncTimesheetToCalendar(req.user.userID, id);
            await GoogleCalendarService.notifyCalendarUpdate(req.user.userID, {
                timesheetId: id,
                syncedVisits: syncResults,
                action: 'synced',
            });
            await NotificationService.triggerNotification({
                event: 'timesheet:calendar_synced',
                data: { timesheetId: id, syncedVisits: syncResults.map((r) => r.visitId) },
                metadata: { syncedBy: req.user.email },
            });
            logger.info('Successfully synced timesheet to Google Calendar', {
                route: 'timesheets/sync',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { timesheetID: id, syncedVisitCount: syncResults.length },
            });
            return res.status(200).json(syncResults);
        } catch (error) {
            const response = TimesheetController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logger.error('Failed to sync timesheet to calendar', {
                route: 'timesheets/sync',
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
            const { supervisorId, weekStart, criteria } = req.body;
            const suggestions = await TimesheetService.suggestTimesheet(supervisorId, weekStart, criteria);
            await NotificationService.triggerNotification({
                event: 'timesheet:suggested',
                data: { supervisorId, weekStart, suggestionCount: suggestions.length },
                metadata: { requestedBy: req.user.email },
            });
            logger.info('Successfully generated timesheet suggestions', {
                route: 'timesheets/suggest',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { supervisorId, weekStart, suggestionCount: suggestions.length },
            });
            return res.status(200).json({ suggestions });
        } catch (error) {
            const response = TimesheetController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logger.error('Failed to generate timesheet suggestions', {
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
}

module.exports = TimesheetController;