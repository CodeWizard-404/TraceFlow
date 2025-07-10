const VisitService = require('../services/visitService');
const GoogleCalendarService = require('../services/googleCalendarService');
const VaultService = require('../services/vaultService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { Visit, Timesheet, User, Reason, Checklist, Agent } = require('../models');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');

class VisitController {
    static async validateOTP(req, res) {
        try {
            const { visitId, otpCode } = req.body;
            if (!visitId || !otpCode) {
                logRequest({
                    req,
                    status: 400,
                    message: 'visitId and otpCode are required',
                    level: 'info',
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(400).json({ error: 'visitId and otpCode are required' });
            }

            const result = await VisitService.validateVisitOTP(visitId, otpCode, req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('visits');
            await cacheInstance.invalidateByTag('timesheets');
            await cacheInstance.invalidate(`visit:${visitId}`);
            const visit = await Visit.findByPk(visitId, { include: [{ model: Timesheet }] });
            if (visit) {
                await cacheInstance.invalidate(`timesheet:${visit.timesheetID}`);
                await cacheInstance.invalidate(`visits:by_timesheet:${visit.timesheetID}`);
                await RedisUtils.publishEvent('cache:invalidate', `timesheet:${visit.timesheetID}`);
                await RedisUtils.publishEvent('cache:invalidate', `visits:by_timesheet:${visit.timesheetID}`);
            }
            await redis.set('visits:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `visit:${visitId}`);

            const requestID = uuidv4();
            logRequest({
                req,
                res: result,
                status: 200,
                message: `OTP validated for visit ${visitId}`,
                level: 'info',
                metadata: { visitID: visitId, requestID },
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to validate OTP: ${error.message}`,
                level: 'error',
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to validate OTP' });
        }
    }

    static async logVisit(req, res) {
        try {
            const { id } = req.params;
            const { duration, checklistUpdates, comment, date, time, status } = req.body;
            const files = req.files || [];
            if (!id) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Visit ID is required',
                    level: 'info',
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            if (!files || files.length === 0) {
                logRequest({
                    req,
                    status: 400,
                    message: 'At least one photo is required to log a visit',
                    level: 'info',
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(400).json({ error: 'At least one photo is required to log a visit' });
            }

            const visit = await VisitService.logVisit(id, { duration, checklistUpdates, comment, date, time, status }, files, req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('visits');
            await cacheInstance.invalidateByTag('timesheets');
            await cacheInstance.invalidate(`visit:${id}`);
            await cacheInstance.invalidate(`timesheet:${visit.timesheetID}`);
            await cacheInstance.invalidate(`visits:by_timesheet:${visit.timesheetID}`);
            await redis.set('visits:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `visit:${id}`);
            await RedisUtils.publishEvent('cache:invalidate', `timesheet:${visit.timesheetID}`);
            await RedisUtils.publishEvent('cache:invalidate', `visits:by_timesheet:${visit.timesheetID}`);

            try {
                const timesheet = await Timesheet.findByPk(visit.timesheetID, { include: [{ model: User }] });
                const userId = timesheet.User.userID;
                if (typeof userId !== 'string') {
                    throw new Error(`Invalid userId: ${userId}`);
                }
                const event = await GoogleCalendarService.updateCalendarEvent(userId, id);
                await GoogleCalendarService.notifyCalendarUpdate(userId, {
                    visitId: id,
                    calendarEventId: event.id,
                    action: 'updated',
                });
            } catch (calendarError) {
                logger.warn(`Failed to update calendar event for visit ${id}: ${calendarError.message}`);
            }

            const timesheet = await Timesheet.findByPk(visit.visit.timesheetID, { include: [{ model: User }] });
            const recipientID1 = timesheet?.User?.regionalManagerID || null;
            const recipientID2 = timesheet?.User?.userID || null;
            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'visit:logged',
                data: { visitID: id, duration, comment, status },
                metadata: { loggedBy: req.user.email },
                dynamicRecipients: [recipientID1, recipientID2],
                triggeredByUserID: req.user.userID,
                type: 'visit',
                customMessage: `Visit ${id} logged with status ${status}`,
                requestID,
            });

            logRequest({
                req,
                res: visit,
                status: 200,
                message: `Logged visit ${id}`,
                level: 'info',
                metadata: { visitID: id, timesheetID: visit.timesheetID, requestID },
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(200).json(visit);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to log visit: ${error.message}`,
                level: 'error',
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to log visit' });
        }
    }

    static async getVisitByID(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Visit ID is required',
                    level: 'info',
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }

            const cacheInstance = await cache();
            const visit = await cacheInstance.getOrSet(`visit:${id}`, async () => {
                return await VisitService.getVisitByID(id);
            }, 'api');

            logRequest({
                req,
                res: visit,
                status: 200,
                message: `Retrieved visit ${id}`,
                level: 'info',
                metadata: { visitID: id },
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(200).json(visit);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to retrieve visit: ${error.message}`,
                level: 'error',
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve visit' });
        }
    }

    static async verifyQRCode(req, res) {
        try {
            const { qrData, visitId } = req.body;
            if (!qrData || !visitId) {
                logRequest({
                    req,
                    status: 400,
                    message: 'qrData and visitId are required',
                    level: 'info',
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(400).json({ error: 'qrData and visitId are required' });
            }

            const result = await VisitService.verifyQRCode(qrData, visitId, req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('visits');
            await cacheInstance.invalidateByTag('timesheets');
            await cacheInstance.invalidate(`visit:${visitId}`);
            const visit = await Visit.findByPk(visitId, { include: [{ model: Timesheet }] });
            if (visit) {
                await cacheInstance.invalidate(`timesheet:${visit.timesheetID}`);
                await cacheInstance.invalidate(`visits:by_timesheet:${visit.timesheetID}`);
                await RedisUtils.publishEvent('cache:invalidate', `timesheet:${visit.timesheetID}`);
                await RedisUtils.publishEvent('cache:invalidate', `visits:by_timesheet:${visit.timesheetID}`);
            }
            await redis.set('visits:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `visit:${visitId}`);

            if (result.valid) {
                const requestID = uuidv4();
                logRequest({
                    req,
                    res: result,
                    status: 200,
                    message: `QR code verified for visit ${visitId}`,
                    level: 'info',
                    metadata: { visitID: visitId, otpID: result.otpID, requestID },
                    service: 'visit',
                    defaultRoute: 'visits'
                });

                return res.status(200).json(result);
            } else {
                logRequest({
                    req,
                    res: result,
                    status: 400,
                    message: `QR code verification failed for visit ${visitId}`,
                    level: 'info',
                    metadata: { visitID: visitId },
                    service: 'visit',
                    defaultRoute: 'visits'
                });

                return res.status(400).json(result);
            }
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to verify QR code: ${error.message}`,
                level: 'error',
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to verify QR code' });
        }
    }

    static async updateVisit(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { id } = req.params;
            const { date, time, duration, location, status, comment, agentID, checklists, reasons, photosToRemove, supervisorID } = req.body;
            const files = req.files || [];
            if (!id) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Visit ID is required',
                    level: 'info',
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }

            const visit = await VisitService.updateVisit(id, { date, time, duration, location, status, comment, agentID, checklists, reasons, photosToRemove, supervisorID }, files, req.user.userID, { transaction });
            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('visits');
            await cacheInstance.invalidateByTag('timesheets');
            await cacheInstance.invalidate(`visit:${id}`);
            await cacheInstance.invalidate(`timesheet:${visit.timesheetID}`);
            await cacheInstance.invalidate(`visits:by_timesheet:${visit.timesheetID}`);
            await redis.set('visits:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `visit:${id}`);
            await RedisUtils.publishEvent('cache:invalidate', `timesheet:${visit.timesheetID}`);
            await RedisUtils.publishEvent('cache:invalidate', `visits:by_timesheet:${visit.timesheetID}`);

            const timesheet = await Timesheet.findByPk(visit.visit.timesheetID, { include: [{ model: User }] });
            const recipientID1 = timesheet?.User?.regionalManagerID || null;
            const recipientID2 = timesheet?.User?.userID || null;
            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'visit:updated',
                data: { visitID: id, updates: Object.keys(req.body), status },
                metadata: { updatedBy: req.user.email },
                dynamicRecipients: [recipientID1, recipientID2],
                triggeredByUserID: req.user.userID,
                type: 'visit',
                customMessage: `Visit ${visit.visit.Date} - ${visit.visit.time} updated with status ${visit.visit.status}`,
                requestID,
            });

            logRequest({
                req,
                res: visit,
                status: 200,
                message: `Updated visit ${id}`,
                level: 'info',
                metadata: { visitID: id, timesheetID: visit.timesheetID, requestID },
                service: 'visit',
                defaultRoute: 'visits'
            });

            await transaction.commit();
            return res.status(200).json(visit);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to update visit: ${error.message}`,
                level: 'error',
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to update visit' });
        }
    }

    static async deleteVisit(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Visit ID is required',
                    level: 'info',
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }

            const visit = await Visit.findByPk(id, { include: [{ model: Timesheet, include: [{ model: User }] }] });
            if (!visit) {
                logRequest({
                    req,
                    status: 404,
                    message: 'Visit not found',
                    level: 'info',
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(404).json({ error: 'Visit not found' });
            }

            const result = await VisitService.deleteVisit(id, req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('visits');
            await cacheInstance.invalidateByTag('timesheets');
            await cacheInstance.invalidate(`visit:${id}`);
            await cacheInstance.invalidate(`timesheet:${visit.Timesheet.timesheetID}`);
            await cacheInstance.invalidate(`visits:by_timesheet:${visit.Timesheet.timesheetID}`);
            await redis.set('visits:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `visit:${id}`);
            await RedisUtils.publishEvent('cache:invalidate', `timesheet:${visit.Timesheet.timesheetID}`);
            await RedisUtils.publishEvent('cache:invalidate', `visits:by_timesheet:${visit.Timesheet.timesheetID}`);

            try {
                if (visit.Timesheet?.User) {
                    const userId = visit.Timesheet.User.userID;
                    if (typeof userId !== 'string') {
                        throw new Error(`Invalid userId: ${userId}`);
                    }
                    await GoogleCalendarService.deleteCalendarEvent(userId, id);
                    await GoogleCalendarService.notifyCalendarUpdate(userId, {
                        visitId: id,
                        action: 'deleted',
                    });
                }
            } catch (calendarError) {
                logger.warn(`Failed to delete calendar event for visit ${id}: ${calendarError.message}`);
            }

            const recipientID1 = visit?.Timesheet?.User?.regionalManagerID || null;
            const recipientID2 = visit?.Timesheet?.User?.userID || null;
            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'visit:deleted',
                data: { visitID: id },
                metadata: { deletedBy: req.user.email },
                dynamicRecipients: [recipientID1, recipientID2],
                triggeredByUserID: req.user.userID,
                type: 'visit',
                customMessage: `Visit ${id} deleted`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Deleted visit ${id}`,
                level: 'info',
                metadata: { visitID: id, timesheetID: visit.Timesheet.timesheetID, requestID },
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to delete visit: ${error.message}`,
                level: 'error',
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to delete visit' });
        }
    }

    static async syncVisitToCalendar(req, res) {
        const { visitId } = req.params;

        try {
            const visit = await Visit.findByPk(visitId, {
                include: [
                    { model: Timesheet, include: [{ model: User }] },
                    { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                    { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } },
                ],
            });

            if (!visit) {
                logRequest({
                    req,
                    status: 404,
                    message: 'Visit not found',
                    level: 'info',
                    metadata: { visitID: visitId },
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(404).json({ error: 'Visit not found' });
            }

            if (!visit.Timesheet) {
                logRequest({
                    req,
                    status: 404,
                    message: 'Timesheet not found for visit',
                    level: 'info',
                    metadata: { visitID: visitId },
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(404).json({ error: 'Timesheet not found for this visit' });
            }

            if (!visit.Timesheet.User) {
                logRequest({
                    req,
                    status: 404,
                    message: 'User not found for timesheet',
                    level: 'info',
                    metadata: { visitID: visitId },
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(404).json({ error: 'User not found for this timesheet' });
            }

            const userId = visit.Timesheet.User.userID;
            if (typeof userId !== 'string') {
                logRequest({
                    req,
                    status: 500,
                    message: `Invalid userId type: expected string, got ${typeof userId}`,
                    level: 'error',
                    metadata: { visitID: visitId, userId },
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(500).json({ error: 'Invalid user ID type' });
            }

            const accessToken = await VaultService.getAccessToken(userId);
            const event = await GoogleCalendarService.createCalendarEvent(userId, visitId);
            await GoogleCalendarService.notifyCalendarUpdate(userId, {
                visitId,
                calendarEventId: event.id,
                action: 'created',
            });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('visits');
            await cacheInstance.invalidateByTag('timesheets');
            await cacheInstance.invalidate(`visit:${visitId}`);
            await cacheInstance.invalidate(`timesheet:${visit.Timesheet.timesheetID}`);
            await cacheInstance.invalidate(`visits:by_timesheet:${visit.Timesheet.timesheetID}`);
            await redis.set('visits:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `visit:${visitId}`);
            await RedisUtils.publishEvent('cache:invalidate', `timesheet:${visit.Timesheet.timesheetID}`);
            await RedisUtils.publishEvent('cache:invalidate', `visits:by_timesheet:${visit.Timesheet.timesheetID}`);

            const requestID = uuidv4();
            logRequest({
                req,
                res: { visitID: visitId, calendarEventId: event.id },
                status: 200,
                message: `Synced visit ${visitId} to calendar`,
                level: 'info',
                metadata: { visitID: visitId, timesheetID: visit.Timesheet.timesheetID, requestID },
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(200).json({ visitID: visitId });
        } catch (error) {
            if (error.message.includes('Invalid Credentials')) {
                const visitError = await Visit.findByPk(visitId, { include: [{ model: Timesheet, include: [{ model: User }] }] });
                if (visitError?.Timesheet?.User) {
                    await User.update(
                        { hasCalendarAccess: false },
                        { where: { userID: visitError.Timesheet.User.userID } }
                    );
                }
                logRequest({
                    req,
                    error,
                    status: 401,
                    message: `Invalid Google Calendar credentials`,
                    level: 'error',
                    metadata: { visitID: visitId },
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(401).json({ error: 'Invalid Google Calendar credentials. Please re-authorize.' });
            }

            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to sync visit to calendar: ${error.message}`,
                level: 'error',
                metadata: { visitID: visitId },
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(500).json({ error: 'Failed to sync visit to calendar' });
        }
    }

    static async listCalendarEvents(req, res) {
        const { timesheetId } = req.params;

        try {
            if (!timesheetId) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Timesheet ID is required',
                    level: 'info',
                    metadata: { timesheetID: timesheetId },
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(400).json({ error: 'Timesheet ID is required' });
            }

            const timesheet = await Timesheet.findByPk(timesheetId, { include: [{ model: User }] });
            if (!timesheet) {
                logRequest({
                    req,
                    status: 404,
                    message: 'Timesheet not found',
                    level: 'info',
                    metadata: { timesheetID: timesheetId },
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(404).json({ error: 'Timesheet not found' });
            }

            if (!timesheet.User) {
                logRequest({
                    req,
                    status: 404,
                    message: 'User not found for timesheet',
                    level: 'info',
                    metadata: { timesheetID: timesheetId },
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(404).json({ error: 'Supervisor not found' });
            }

            const userId = timesheet.User.userID;
            if (typeof userId !== 'string') {
                logRequest({
                    req,
                    status: 500,
                    message: `Invalid userId type: expected string, got ${typeof userId}`,
                    level: 'error',
                    metadata: { timesheetID: timesheetId, userId },
                    service: 'visit',
                    defaultRoute: 'visits'
                });
                return res.status(500).json({ error: 'Invalid user ID' });
            }

            const cacheInstance = await cache();
            const cacheKey = `calendar_events:${timesheetId}`;
            const events = await cacheInstance.getOrSet(cacheKey, async () => {
                return await GoogleCalendarService.listCalendarEvents(userId, timesheetId);
            }, 'api');

            logRequest({
                req,
                res: events,
                status: 200,
                message: `Retrieved calendar events for timesheet ${timesheetId}`,
                level: 'info',
                metadata: { timesheetID: timesheetId, eventCount: events.length },
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(200).json(events);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to list calendar events: ${error.message}`,
                level: 'error',
                metadata: { timesheetID: timesheetId },
                service: 'visit',
                defaultRoute: 'visits'
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to list calendar events' });
        }
    }
}

module.exports = VisitController;