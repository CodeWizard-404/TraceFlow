const { validationResult } = require('express-validator');
const TimesheetService = require('../services/timesheetService');
const GoogleCalendarService = require('../services/googleCalendarService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { Timesheet, User, Visit, Agent, Reason, Checklist } = require('../models');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');

const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    SERVER_ERROR: 'Something broke. Try again later.',
    INVALID_SUPERVISOR: 'Invalid supervisor ID.',
    INVALID_WEEK_START: 'Invalid week start date.',
    REQUEST_CANCELED: 'AI request canceled.',
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
        try {
            const cacheInstance = await cache();
            const cacheKey = 'timesheets:all';
            const timesheets = await cacheInstance.getOrSet(cacheKey, async () => {
                return await TimesheetService.listTimesheets();
            }, 'api');

            logRequest({
                req,
                res: timesheets,
                status: 200,
                message: `Retrieved ${timesheets.length} timesheets`,
                level: 'info',
                metadata: { timesheetCount: timesheets.length },
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(200).json(timesheets);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch all timesheets: ${error.message}`,
                level: 'error',
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(500).json(TimesheetController.formatError(error));
        }
    }

    static async getTimesheetById(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const { id } = req.params;
            const cacheInstance = await cache();
            const timesheet = await cacheInstance.getOrSet(`timesheet:${id}`, async () => {
                return await TimesheetService.viewTimesheet(id);
            }, 'api');

            logRequest({
                req,
                res: timesheet,
                status: 200,
                message: `Retrieved timesheet ${id}`,
                level: 'info',
                metadata: { timesheetID: id },
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(200).json(timesheet);
        } catch (error) {
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to fetch timesheet: ${error.message}`,
                level: 'error',
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(status).json(TimesheetController.formatError(error));
        }
    }

    static async getTimesheetsBySupervisor(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const { supervisorID } = req.params;
            const cacheInstance = await cache();
            const timesheets = await cacheInstance.getOrSet(`timesheets:supervisor:${supervisorID}`, async () => {
                return await TimesheetService.getTimesheetsBySupervisor(supervisorID);
            }, 'api');

            logRequest({
                req,
                res: timesheets,
                status: 200,
                message: `Retrieved timesheets for supervisor ${supervisorID}`,
                level: 'info',
                metadata: { supervisorID, timesheetCount: timesheets.length },
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(200).json(timesheets);
        } catch (error) {
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to fetch timesheets by supervisor: ${error.message}`,
                level: 'error',
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(status).json(TimesheetController.formatError(error));
        }
    }

    static async getTimesheetByWeekNumberAndYear(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const { weekNumber, year, supervisorID } = req.params;
            const cacheInstance = await cache();
            const cacheKey = `timesheet:week:${weekNumber}:year:${year}:supervisor:${supervisorID}`;
            const timesheet = await cacheInstance.getOrSet(cacheKey, async () => {
                return await TimesheetService.getTimesheetByWeekAndYear(weekNumber, year, supervisorID);
            }, 'api');

            logRequest({
                req,
                res: timesheet,
                status: 200,
                message: `Retrieved timesheet for week ${weekNumber}, year ${year}`,
                level: 'info',
                metadata: { weekNumber, year, supervisorID },
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(200).json(timesheet);
        } catch (error) {
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to fetch timesheet by week number and year: ${error.message}`,
                level: 'error',
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(status).json(TimesheetController.formatError(error));
        }
    }

    static async createTimesheet(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const { weekNumber, year, supervisorID, visits, status = 'pending' } = req.body;
            if (!['pending', 'visited', 'rejected', 'validated'].includes(status)) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Invalid status',
                    level: 'info',
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(400).json({ error: 'Invalid status' });
            }

            const result = await TimesheetService.createTimesheet({ weekNumber, year, supervisorID, visits, status }, req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('timesheets');
            await cacheInstance.invalidate('timesheets:all');
            await cacheInstance.invalidate(`timesheets:supervisor:${supervisorID}`);
            await cacheInstance.invalidate(`timesheet:${result.timesheet.timesheetID}`);
            for (const visit of visits || []) {
                await cacheInstance.invalidate(`visits:by_timesheet:${result.timesheet.timesheetID}`);
            }
            await redis.set('timesheets:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'timesheets:all');
            await RedisUtils.publishEvent('cache:invalidate', `timesheets:supervisor:${supervisorID}`);
            await RedisUtils.publishEvent('cache:invalidate', `timesheet:${result.timesheet.timesheetID}`);

            const supervisor = await User.findByPk(supervisorID);
            const recipientID = supervisor?.regionalManagerID || supervisor?.supervisorID || null;
            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'timesheet:created',
                data: { timesheetID: result.timesheet.timesheetID, supervisorID, weekNumber, year, status },
                metadata: { createdBy: req.user.email },
                dynamicRecipients: recipientID ? [recipientID] : undefined,
                triggeredByUserID: req.user.userID,
                type: 'timesheet',
                customMessage: `Timesheet created for week ${weekNumber}, year ${year}`,
                requestID,
            });

            logRequest({
                req,
                res: result.timesheet,
                status: 201,
                message: `Created timesheet ${result.timesheet.timesheetID}`,
                level: 'info',
                metadata: { timesheetID: result.timesheet.timesheetID, supervisorID, visitCount: visits ? visits.length : 0, requestID },
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            const response = { timesheet: result.timesheet };
            if (result.warning) {
                response.warning = result.warning;
            }

            return res.status(201).json(response);
        } catch (error) {
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS || error.message === 'Invalid status' ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to create timesheet: ${error.message}`,
                level: 'error',
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(status).json(TimesheetController.formatError(error));
        }
    }

    static async validateTimesheet(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const { id } = req.params;
            const { visitIDs = [], status } = req.body;
            if (!['pending', 'visited', 'rejected', 'validated'].includes(status)) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Invalid status',
                    level: 'info',
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(400).json({ error: 'Invalid status' });
            }

            const timesheet = await TimesheetService.validateTimesheet(id, { visitIDs, status }, req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('timesheets');
            await cacheInstance.invalidate('timesheets:all');
            await cacheInstance.invalidate(`timesheet:${id}`);
            await cacheInstance.invalidate(`timesheets:supervisor:${timesheet.supervisorID}`);
            await cacheInstance.invalidate(`visits:by_timesheet:${id}`);
            await redis.set('timesheets:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `timesheet:${id}`);
            await RedisUtils.publishEvent('cache:invalidate', 'timesheets:all');
            await RedisUtils.publishEvent('cache:invalidate', `timesheets:supervisor:${timesheet.supervisorID}`);
            await RedisUtils.publishEvent('cache:invalidate', `visits:by_timesheet:${id}`);

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
            } catch (syncError) {
                logger.warn(`Failed to sync timesheet ${id} to calendar after validation: ${syncError.message}`, {
                    userId: timesheet.supervisorID,
                    timesheetId: id,
                });
            }

            const supervisor = await User.findByPk(timesheet.supervisorID);
            const recipientID = supervisor?.regionalManagerID || supervisor?.supervisorID || null;
            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'timesheet:validated',
                data: { timesheetID: id, status, supervisorID: timesheet.supervisorID },
                metadata: { validatedBy: req.user.email },
                dynamicRecipients: recipientID ? [recipientID] : undefined,
                triggeredByUserID: req.user.userID,
                type: 'timesheet',
                customMessage: `Timesheet ${id} validated with status ${status}`,
                requestID,
            });

            logRequest({
                req,
                res: timesheet,
                status: 200,
                message: `Validated timesheet ${id}`,
                level: 'info',
                metadata: { timesheetID: id, status, visitCount: visitIDs.length, requestID },
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(200).json(timesheet);
        } catch (error) {
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS || error.message === 'Invalid status' ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to validate timesheet: ${error.message}`,
                level: 'error',
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(status).json(TimesheetController.formatError(error));
        }
    }

    static async suggestTimesheet(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const { supervisorID, weekNumber, year, coordinates } = req.body;
            const criteria = req.body.criteria || {};

            if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.INVALID_COORDINATES,
                    level: 'info',
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.INVALID_COORDINATES });
            }

            const result = await TimesheetService.suggestTimesheet(supervisorID, weekNumber, year, criteria, coordinates);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('timesheets');
            await cacheInstance.invalidate('timesheets:all');
            await cacheInstance.invalidate(`timesheets:supervisor:${supervisorID}`);
            await redis.set('timesheets:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'timesheets:all');
            await RedisUtils.publishEvent('cache:invalidate', `timesheets:supervisor:${supervisorID}`);

            const supervisor = await User.findByPk(supervisorID);
            const recipientID = supervisor?.regionalManagerID || supervisor?.supervisorID || null;
            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'timesheet:suggested',
                data: { supervisorID, weekNumber, year, suggestionCount: result.suggestions.length },
                metadata: { suggestedBy: req.user.email },
                dynamicRecipients: recipientID ? [recipientID] : undefined,
                triggeredByUserID: req.user.userID,
                type: 'timesheet',
                customMessage: `Suggested timesheet for week ${weekNumber}, year ${year}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Suggested timesheet for supervisor ${supervisorID}`,
                level: 'info',
                metadata: { supervisorID, weekNumber, year, suggestionCount: result.suggestions.length, requestID },
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(200).json(result);
        } catch (error) {
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ||
                error.message === ERROR_MESSAGES.INVALID_COORDINATES ||
                error.message === ERROR_MESSAGES.REQUEST_CANCELED ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to suggest timesheet: ${error.message}`,
                level: 'error',
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(status).json(TimesheetController.formatError(error));
        }
    }

    static async cancelTimesheetSuggestion(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const { requestId } = req.params;
            const success = await TimesheetService.cancelTimesheetSuggestion(requestId);

            if (!success) {
                logRequest({
                    req,
                    status: 404,
                    message: 'No active suggestion request found for the provided ID',
                    level: 'info',
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(404).json({ error: 'No active suggestion request found for the provided ID' });
            }

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('timesheets');
            await cacheInstance.invalidate('timesheets:all');
            await redis.set('timesheets:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'timesheets:all');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'timesheet:suggestion_canceled',
                data: { requestId },
                metadata: { canceledBy: req.user.email },
                triggeredByUserID: req.user.userID,
                type: 'timesheet',
                customMessage: `Canceled timesheet suggestion request ${requestId}`,
                requestID,
            });

            logRequest({
                req,
                res: { message: 'Timesheet suggestion request canceled successfully' },
                status: 200,
                message: `Canceled timesheet suggestion ${requestId}`,
                level: 'info',
                metadata: { requestId, requestID },
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(200).json({ message: 'Timesheet suggestion request canceled successfully' });
        } catch (error) {
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to cancel timesheet suggestion: ${error.message}`,
                level: 'error',
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(status).json(TimesheetController.formatError(error));
        }
    }

    static async syncTimesheetToCalendar(req, res) {
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
                logRequest({
                    req,
                    status: 404,
                    message: 'Timesheet not found',
                    level: 'info',
                    metadata: { timesheetID: id },
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(404).json({ error: 'Timesheet not found' });
            }

            if (!timesheet.User) {
                logRequest({
                    req,
                    status: 404,
                    message: 'User not found for timesheet',
                    level: 'info',
                    metadata: { timesheetID: id },
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(404).json({ error: 'User not found for this timesheet' });
            }

            const userId = timesheet.User.userID;
            if (typeof userId !== 'string') {
                logRequest({
                    req,
                    status: 500,
                    message: `Invalid userId type: expected string, got ${typeof userId}`,
                    level: 'error',
                    metadata: { timesheetID: id, userId },
                    service: 'timesheet',
                    defaultRoute: 'timesheets'
                });
                return res.status(500).json({ error: 'Invalid user ID type' });
            }

            const syncResults = await GoogleCalendarService.syncTimesheetToCalendar(userId, id);
            await GoogleCalendarService.notifyCalendarUpdate(userId, {
                timesheetId: id,
                syncedVisits: syncResults,
                action: 'synced',
            });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('timesheets');
            await cacheInstance.invalidate('timesheets:all');
            await cacheInstance.invalidate(`timesheet:${id}`);
            await cacheInstance.invalidate(`timesheets:supervisor:${timesheet.supervisorID}`);
            await cacheInstance.invalidate(`visits:by_timesheet:${id}`);
            await redis.set('timesheets:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `timesheet:${id}`);
            await RedisUtils.publishEvent('cache:invalidate', 'timesheets:all');
            await RedisUtils.publishEvent('cache:invalidate', `timesheets:supervisor:${timesheet.supervisorID}`);
            await RedisUtils.publishEvent('cache:invalidate', `visits:by_timesheet:${id}`);

            const supervisor = await User.findByPk(timesheet.supervisorID);
            const recipientID = supervisor?.regionalManagerID || supervisor?.supervisorID || null;
            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'timesheet:synced',
                data: { timesheetID: id, supervisorID: timesheet.supervisorID, syncedVisitCount: syncResults.length },
                metadata: { syncedBy: req.user.email },
                dynamicRecipients: recipientID ? [recipientID] : undefined,
                triggeredByUserID: req.user.userID,
                type: 'timesheet',
                customMessage: `Timesheet ${id} synced to calendar`,
                requestID,
            });

            logRequest({
                req,
                res: { timesheetID: id, syncedVisits: syncResults },
                status: 200,
                message: `Synced timesheet ${id} to calendar`,
                level: 'info',
                metadata: { timesheetID: id, syncedVisitCount: syncResults.length, requestID },
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(200).json({ timesheetID: id, syncedVisits: syncResults });
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to sync timesheet to calendar: ${error.message}`,
                level: 'error',
                metadata: { timesheetID: req.params.id },
                service: 'timesheet',
                defaultRoute: 'timesheets'
            });

            return res.status(500).json(TimesheetController.formatError(error));
        }
    }
}

module.exports = TimesheetController;