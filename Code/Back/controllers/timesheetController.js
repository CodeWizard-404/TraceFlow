const TimesheetService = require('../services/timesheetService');
const GoogleCalendarService = require('../services/googleCalendarService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

class TimesheetController {
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
            logger.error('Failed to fetch all timesheets', {
                route: 'timesheets',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message },
            });
            return res.status(500).json({ error: error.message || 'Failed to retrieve timesheets' });
        }
    }

    static async getTimesheetById(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Get timesheet failed: Missing timesheet ID', {
                    route: 'timesheets',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {},
                });
                return res.status(400).json({ error: 'Timesheet ID is required' });
            }
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
            logger.error('Failed to fetch timesheet', {
                route: 'timesheets',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message },
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve timesheet' });
        }
    }

    static async getTimesheetsBySupervisor(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { supervisorID } = req.params;
            if (!supervisorID) {
                logger.warn('Get timesheets by supervisor failed: Missing supervisorID', {
                    route: 'timesheets/supervisor',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {},
                });
                return res.status(400).json({ error: 'Supervisor ID is required' });
            }
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
            logger.error('Failed to fetch timesheets by supervisor', {
                route: 'timesheets/supervisor',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message },
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve timesheets for supervisor' });
        }
    }

    static async createTimesheet(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { weekNumber, year, supervisorID, visits, status = 'pending' } = req.body;
            if (!weekNumber || !year || !supervisorID || !Array.isArray(visits)) {
                logger.warn('Create timesheet failed: Missing required fields', {
                    route: 'timesheets',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { missingFields: { weekNumber, year, supervisorID, visits } },
                });
                return res.status(400).json({ error: 'weekNumber, year, supervisorID, and visits array are required' });
            }
            if (status && !['pending', 'validated'].includes(status)) {
                logger.warn('Create timesheet failed: Invalid status', {
                    route: 'timesheets',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { status },
                });
                return res.status(400).json({ error: 'Status must be "pending" or "validated"' });
            }
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
            logger.error('Failed to create timesheet', {
                route: 'timesheets',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message },
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to create timesheet' });
        }
    }

    static async validateTimesheet(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            const { visitIDs = [], status } = req.body;
            if (!id) {
                logger.warn('Validate timesheet failed: Missing timesheet ID', {
                    route: 'timesheets/validate',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {},
                });
                return res.status(400).json({ error: 'Timesheet ID is required' });
            }
            if (!status) {
                logger.warn('Validate timesheet failed: Missing status', {
                    route: 'timesheets/validate',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {},
                });
                return res.status(400).json({ error: 'Status is required' });
            }
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
            logger.error('Failed to validate timesheet', {
                route: 'timesheets/validate',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message },
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to validate timesheet' });
        }
    }

    static async syncTimesheetToCalendar(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Sync timesheet to calendar failed: Missing timesheet ID', {
                    route: 'timesheets/sync',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {},
                });
                return res.status(400).json({ error: 'Timesheet ID is required' });
            }
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
            logger.error('Failed to sync timesheet to calendar', {
                route: 'timesheets/sync',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message },
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to sync timesheet to calendar' });
        }
    }
}

module.exports = TimesheetController;