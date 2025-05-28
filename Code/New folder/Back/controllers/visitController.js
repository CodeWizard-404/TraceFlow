const VisitService = require('../services/visitService');
const GoogleCalendarService = require('../services/googleCalendarService');
const VaultService = require('../services/vaultService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { Visit, Timesheet, User, Reason, Checklist, Agent } = require('../models');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');

class VisitController {
    static async validateOTP(req, res) {
        try {
            const { visitId, otpCode } = req.body;
            if (!visitId || !otpCode) {
                logger.warn(`Validate OTP failed: Missing visitId or otpCode, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'visitId and otpCode are required' });
            }
            const result = await VisitService.validateVisitOTP(visitId, otpCode, req.user.userID);
            logger.info(`OTP validated for visit ${visitId} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`OTP validation error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to validate OTP' });
        }
    }

    static async logVisit(req, res) {
        try {
            const { id } = req.params;
            const { duration, checklistUpdates, comment, date, time, status } = req.body;
            const files = req.files || [];
            if (!id) {
                logger.warn(`Log visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            if (!files || files.length === 0) {
                logger.warn(`Log visit failed: At least one photo is required to log a visit, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'At least one photo is required to log a visit' });
            }
            const visit = await VisitService.logVisit(id, { duration, checklistUpdates, comment, date, time, status }, files, req.user.userID);
            try {
                const timesheet = await Timesheet.findByPk(visit.timesheetID, { include: [{ model: User }] });
                if (!timesheet) {
                    logger.error(`Timesheet not found for visit ${id}, timesheetID: ${visit.timesheetID}`);
                    throw new Error('Timesheet not found');
                }
                if (!timesheet.User) {
                    logger.error(`User not found for timesheet ${visit.timesheetID}, supervisorID: ${timesheet.supervisorID}`);
                    throw new Error('Supervisor not found');
                }
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
            } catch (error) {
                logger.warn(`Failed to update calendar event for visit ${id}: ${error.message}`);
            }
            await NotificationService.triggerNotification({
                event: 'visit:logged',
                data: { visitId: id, duration, comment, status },
                metadata: { loggedBy: req.user.email },
            });
            logger.info(`Visit ${id} logged by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(visit);
        } catch (error) {
            logger.error(`Log visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to log visit' });
        }
    }

    static async getVisitByID(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Get visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await VisitService.getVisitByID(id);
            logger.info(`Fetched visit ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(visit);
        } catch (error) {
            logger.error(`Get visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve visit' });
        }
    }

    static async verifyQRCode(req, res) {
        try {
            const { qrData, visitId } = req.body;
            if (!qrData || !visitId) {
                logger.warn(`Verify QR code failed: Missing qrData or visitId, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'qrData and visitId are required' });
            }
            const result = await VisitService.verifyQRCode(qrData, visitId, req.user.userID);
            if (result.valid) {
                await NotificationService.triggerNotification({
                    event: 'visit:qr_verified',
                    data: { visitId, qrData, otpID: result.otpID },
                    metadata: { verifiedBy: req.user.email },
                });
            }
            logger.info(`QR code verified for visit ${visitId} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(result.valid ? 200 : 400).json(result);
        } catch (error) {
            logger.error(`QR verification error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
                logger.warn(`Update visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                await transaction.rollback();
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const result = await VisitService.updateVisit(id, { date, time, duration, location, status, comment, agentID, checklists, reasons, photosToRemove, supervisorID }, files, req.user.userID, { transaction });
            await NotificationService.triggerNotification({
                event: 'visit:updated',
                data: { visitId: id, updates: Object.keys(req.body), status },
                metadata: { updatedBy: req.user.email },
            });
            logger.info(`Updated visit ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logger.error(`Update visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to update visit' });
        }
    }

    static async deleteVisit(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Delete visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await Visit.findByPk(id, { include: [{ model: Timesheet, include: [{ model: User }] }] });
            if (!visit) {
                logger.warn(`Delete visit failed: Visit not found, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(404).json({ error: 'Visit not found' });
            }
            const result = await VisitService.deleteVisit(id, req.user.userID);
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
            } catch (error) {
                logger.warn(`Failed to delete calendar event for visit ${id}: ${error.message}`);
            }
            await NotificationService.triggerNotification({
                event: 'visit:deleted',
                data: { visitId: id },
                metadata: { deletedBy: req.user.email },
            });
            logger.info(`Deleted visit ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Delete visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to delete visit' });
        }
    }

    static async syncVisitToCalendar(req, res) {
        try {
            const visitId = req.params.visitId;
            const visit = await Visit.findByPk(visitId, {
                include: [
                    { model: Timesheet, include: [User] },
                    { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                    { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } }
                ]
            });

            if (!visit) {
                logger.error(`Visit not found`, { visitId, userID: req.user.userID });
                return res.status(404).json({ error: 'Visit not found' });
            }
            if (!visit.Timesheet) {
                logger.error(`Timesheet not found for visit`, { visitId, userID: req.user.userID });
                return res.status(404).json({ error: 'Timesheet not found for this visit' });
            }
            if (!visit.Timesheet.User) {
                logger.error(`User not found for timesheet`, { visitId, userID: req.user.userID });
                return res.status(404).json({ error: 'User not found for this timesheet' });
            }

            const userId = visit.Timesheet.User.userID;
            if (typeof userId !== 'string') {
                logger.error(`Invalid userId type: expected string, got ${typeof userId}`, { userId, visitId });
                return res.status(500).json({ error: 'Invalid user ID type' });
            }

            const accessToken = await VaultService.getAccessToken(userId);
            const event = await GoogleCalendarService.createCalendarEvent(userId, visitId);
            await GoogleCalendarService.notifyCalendarUpdate(userId, {
                visitId,
                calendarEventId: event.id,
                action: 'created',
            });

            return res.status(200).json({ id: visitId });
        } catch (error) {
            if (error.message.includes('Invalid Credentials')) {
                const visit = await Visit.findByPk(req.params.visitId, {
                    include: [{ model: Timesheet, include: [User] }]
                });
                if (visit?.Timesheet?.User) {
                    await User.update(
                        { hasCalendarAccess: false },
                        { where: { userID: visit.Timesheet.User.userID } }
                    );
                }
                logger.error(`Invalid Google Calendar credentials`, { userID: req.user.userID, visitId: req.params.visitId });
                return res.status(401).json({ error: 'Invalid Google Calendar credentials. Please re-authorize.' });
            }

            logger.error(`Sync visit to calendar error: ${error.message}`, {
                method: req.method,
                url: req.originalUrl,
                userID: req.user.userID,
                visitId: req.params.visitId,
            });
            return res.status(500).json({ error: 'Failed to sync visit to calendar' });
        }
    }

    static async listCalendarEvents(req, res) {
        try {
            const { timesheetId } = req.params;
            if (!timesheetId) {
                logger.warn(`List calendar events failed: Missing timesheet ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Timesheet ID is required' });
            }
            const timesheet = await Timesheet.findByPk(timesheetId, { include: [{ model: User }] });
            if (!timesheet) {
                logger.error(`Timesheet not found for timesheetID: ${timesheetId}`);
                throw new Error('Timesheet not found');
            }
            if (!timesheet.User) {
                logger.error(`User not found for timesheet ${timesheetId}, supervisorID: ${timesheet.supervisorID}`);
                throw new Error('Supervisor not found');
            }
            const userId = timesheet.User.userID;
            if (typeof userId !== 'string') {
                throw new Error(`Invalid userId: ${userId}`);
            }
            const events = await GoogleCalendarService.listCalendarEvents(userId, timesheetId);
            logger.info(`Listed calendar events for timesheet ${timesheetId} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(events);
        } catch (error) {
            logger.error(`List calendar events error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to list calendar events' });
        }
    }
}

module.exports = VisitController;