const VisitService = require('../services/visitService');
const GoogleCalendarService = require('../services/googleCalendarService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

class VisitController {
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

    static async logVisit(req, res) {
        try {
            const { id } = req.params;
            const { duration, checklistUpdates, comment, date, time, otpCode } = req.body;
            const files = req.files || [];
            if (!id) {
                logger.warn(`Log visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            if (!files || files.length === 0) {
                logger.warn(`Log visit failed: At least one photo is required to log a visit, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'At least one photo is required to log a visit' });
            }
            const visit = await VisitService.logVisit(id, { duration, checklistUpdates, comment, date, time, otpCode }, files, req.user.userID);
            try {
                const event = await GoogleCalendarService.updateCalendarEvent(req.user.userID, id);
                await GoogleCalendarService.notifyCalendarUpdate(req.user.userID, {
                    visitId: id,
                    calendarEventId: event.id,
                    action: 'updated',
                });
            } catch (error) {
                logger.warn(`Failed to update calendar event for visit ${id}: ${error.message}`);
            }
            await NotificationService.triggerNotification({
                event: 'visit:logged',
                data: { visitId: id, duration, comment },
                metadata: { loggedBy: req.user.email },
            });
            logger.info(`Visit ${id} logged by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(visit);
        } catch (error) {
            logger.error(`Log visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to log visit' });
        }
    }

    static async updateVisit(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const files = req.files || [];
            if (!id) {
                logger.warn(`Update visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await VisitService.updateVisit(id, data, files, req.user.userID);
            try {
                const event = await GoogleCalendarService.updateCalendarEvent(req.user.userID, id);
                await GoogleCalendarService.notifyCalendarUpdate(req.user.userID, {
                    visitId: id,
                    calendarEventId: event.id,
                    action: 'updated',
                });
            } catch (error) {
                logger.warn(`Failed to update calendar event for visit ${id}: ${error.message}`);
            }
            await NotificationService.triggerNotification({
                event: 'visit:updated',
                data: { visitId: id, updates: Object.keys(data) },
                metadata: { updatedBy: req.user.email },
            });
            logger.info(`Updated visit ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(visit);
        } catch (error) {
            logger.error(`Update visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to update visit' });
        }
    }

    static async deleteVisit(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Delete visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ doorbell: 'Visit ID is required' });
            }
            const result = await VisitService.deleteVisit(id, req.user.userID);
            try {
                await GoogleCalendarService.deleteCalendarEvent(req.user.userID, id);
                await GoogleCalendarService.notifyCalendarUpdate(req.user.userID, {
                    visitId: id,
                    action: 'deleted',
                });
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
            const { id } = req.params;
            if (!id) {
                logger.warn(`Sync visit to calendar failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const event = await GoogleCalendarService.createCalendarEvent(req.user.userID, id);
            await GoogleCalendarService.notifyCalendarUpdate(req.user.userID, {
                visitId: id,
                calendarEventId: event.id,
                action: 'created',
            });
            await NotificationService.triggerNotification({
                event: 'visit:calendar_synced',
                data: { visitId: id, calendarEventId: event.id },
                metadata: { syncedBy: req.user.email },
            });
            logger.info(`Synced visit ${id} to Google Calendar by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(event);
        } catch (error) {
            logger.error(`Sync visit to calendar error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to sync visit to calendar' });
        }
    }

    static async listCalendarEvents(req, res) {
        try {
            const { timesheetId } = req.params;
            if (!timesheetId) {
                logger.warn(`List calendar events failed: Missing timesheet ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Timesheet ID is required' });
            }
            const events = await GoogleCalendarService.listCalendarEvents(req.user.userID, timesheetId);
            logger.info(`Listed calendar events for timesheet ${timesheetId} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(events);
        } catch (error) {
            logger.error(`List calendar events error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to list calendar events' });
        }
    }
}

module.exports = VisitController;