const VisitService = require('../services/visitService');
const GoogleCalendarService = require('../services/googleCalendarService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing visit operations with structured logging.
 */
class VisitController {
    /**
     * Get a visit by ID.
     * @param {Object} req - Express request object with visit ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with visit or error.
     */
    static async getVisitByID(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Get visit failed: Missing visit ID', {
                    route: 'visits',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await VisitService.getVisitByID(id);
            logger.info('Successfully fetched visit', {
                route: 'visits',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { visitID: id }
            });
            return res.status(200).json(visit);
        } catch (error) {
            logger.error('Failed to fetch visit', {
                route: 'visits',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve visit' });
        }
    }

    /**
     * Verify QR code for a visit.
     * @param {Object} req - Express request object with qrData and visitId in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with verification result or error.
     */
    static async verifyQRCode(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { qrData, visitId } = req.body;
            if (!qrData || !visitId) {
                logger.warn('Verify QR code failed: Missing qrData or visitId', {
                    route: 'visits/qr-verify',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'qrData and visitId are required' });
            }
            const result = await VisitService.verifyQRCode(qrData, visitId, actorID);
            if (result.valid) {
                await NotificationService.triggerNotification({
                    event: 'visit:qr_verified',
                    data: { visitId, qrData },
                    metadata: { verifiedBy: req.user.email }
                });
                logger.info('Successfully verified QR code', {
                    route: 'visits/qr-verify',
                    method: req.method,
                    url: req.originalUrl,
                    status: 200,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { visitId }
                });
            } else {
                logger.warn('QR code verification failed', {
                    route: 'visits/qr-verify',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { visitId, message: result.message }
                });
            }
            return res.status(result.valid ? 200 : 400).json(result);
        } catch (error) {
            logger.error('Failed to verify QR code', {
                route: 'visits/qr-verify',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to verify QR code' });
        }
    }

    /**
     * Log a visit.
     * @param {Object} req - Express request object with visit ID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with logged visit or error.
     */
    static async logVisit(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            const { duration, checklistUpdates, comment, date, time } = req.body;
            const files = req.files || [];
            if (!id) {
                logger.warn('Log visit failed: Missing visit ID', {
                    route: 'visits/log',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            if (!files || files.length === 0) {
                logger.warn('Log visit failed: At least one photo is required', {
                    route: 'visits/log',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'At least one photo is required to log a visit' });
            }
            const visit = await VisitService.logVisit(id, { duration, checklistUpdates, comment, date, time }, files, actorID);
            await NotificationService.triggerNotification({
                event: 'visit:logged',
                data: { visitId: id, duration, comment },
                metadata: { loggedBy: req.user.email }
            });
            logger.info('Successfully logged visit', {
                route: 'visits/log',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { visitID: id, photoCount: files.length }
            });
            return res.status(200).json(visit);
        } catch (error) {
            logger.error('Failed to log visit', {
                route: 'visits/log',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to log visit' });
        }
    }

    /**
     * Update a visit.
     * @param {Object} req - Express request object with visit ID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated visit or error.
     */
    static async updateVisit(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            const data = req.body;
            const files = req.files || [];
            if (!id) {
                logger.warn('Update visit failed: Missing visit ID', {
                    route: 'visits',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await VisitService.updateVisit(id, data, files, actorID);
            try {
                await GoogleCalendarService.updateCalendarEvent(actorID, id);
            } catch (calendarError) {
                logger.warn('Failed to update calendar event', {
                    route: 'visits',
                    method: req.method,
                    url: req.originalUrl,
                    status: 200,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { visitID: id, error: calendarError.message }
                });
            }
            await NotificationService.triggerNotification({
                event: 'visit:updated',
                data: { visitId: id, updates: Object.keys(data) },
                metadata: { updatedBy: req.user.email }
            });
            logger.info('Successfully updated visit', {
                route: 'visits',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { visitID: id, fileCount: files.length }
            });
            return res.status(200).json(visit);
        } catch (error) {
            logger.error('Failed to update visit', {
                route: 'visits',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to update visit' });
        }
    }

    /**
     * Delete a visit.
     * @param {Object} req - Express request object with visit ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with success message or error.
     */
    static async deleteVisit(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Delete visit failed: Missing visit ID', {
                    route: 'visits',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const result = await VisitService.deleteVisit(id, actorID);
            try {
                await GoogleCalendarService.deleteCalendarEvent(actorID, id);
            } catch (calendarError) {
                logger.warn('Failed to delete calendar event', {
                    route: 'visits',
                    method: req.method,
                    url: req.originalUrl,
                    status: 200,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { visitID: id, error: calendarError.message }
                });
            }
            await NotificationService.triggerNotification({
                event: 'visit:deleted',
                data: { visitId: id },
                metadata: { deletedBy: req.user.email }
            });
            logger.info('Successfully deleted visit', {
                route: 'visits',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { visitID: id }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to delete visit', {
                route: 'visits',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to delete visit' });
        }
    }

    /**
     * Sync a visit to Google Calendar.
     * @param {Object} req - Express request object with visit ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with calendar event or error.
     */
    static async syncVisitToCalendar(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Sync visit to calendar failed: Missing visit ID', {
                    route: 'visits/calendar-sync',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const event = await GoogleCalendarService.createCalendarEvent(actorID, id);
            await NotificationService.triggerNotification({
                event: 'visit:calendar_synced',
                data: { visitId: id, calendarEventId: event.id },
                metadata: { syncedBy: req.user.email }
            });
            logger.info('Successfully synced visit to Google Calendar', {
                route: 'visits/calendar-sync',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { visitID: id, calendarEventId: event.id }
            });
            return res.status(200).json(event);
        } catch (error) {
            logger.error('Failed to sync visit to calendar', {
                route: 'visits/calendar-sync',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to sync visit to calendar' });
        }
    }

    /**
     * Sync all visits to Google Calendar.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with calendar events or error.
     */
    static async syncAllVisitsToCalendar(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const visits = await VisitService.getVisitsByUser(actorID);
            const events = await Promise.all(visits.map(visit => GoogleCalendarService.createCalendarEvent(actorID, visit._id)));
            await NotificationService.triggerNotification({
                event: 'visit:calendar_synced',
                data: { visitIds: visits.map(visit => visit._id), calendarEventIds: events.map(event => event.id) },
                metadata: { syncedBy: req.user.email }
            });
            logger.info('Successfully synced all visits to Google Calendar', {
                route: 'visits/calendar-sync-all',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { visitCount: visits.length }
            });
            return res.status(200).json(events);
        } catch (error) {
            logger.error('Failed to sync all visits to calendar', {
                route: 'visits/calendar-sync-all',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to sync all visits to calendar' });
        }
    }

    /**
     * Update a Google Calendar event for a visit.
     * @param {Object} req - Express request object with visit ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated calendar event or error.
     */
    static async updateCalendarEvent(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Update calendar event failed: Missing visit ID', {
                    route: 'visits/calendar-update',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const event = await GoogleCalendarService.updateCalendarEvent(actorID, id);
            await NotificationService.triggerNotification({
                event: 'visit:calendar_updated',
                data: { visitId: id, calendarEventId: event.id },
                metadata: { updatedBy: req.user.email }
            });
            logger.info('Successfully updated Google Calendar event', {
                route: 'visits/calendar-update',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { visitID: id, calendarEventId: event.id }
            });
            return res.status(200).json(event);
        } catch (error) {
            logger.error('Failed to update calendar event', {
                route: 'visits/calendar-update',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to update calendar event' });
        }
    }

    /**
     * Delete a Google Calendar event for a visit.
     * @param {Object} req - Express request object with visit ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with success message or error.
     */
    static async deleteCalendarEvent(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn('Delete calendar event failed: Missing visit ID', {
                    route: 'visits/calendar-delete',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const result = await GoogleCalendarService.deleteCalendarEvent(actorID, id);
            await NotificationService.triggerNotification({
                event: 'visit:calendar_deleted',
                data: { visitId: id },
                metadata: { deletedBy: req.user.email }
            });
            logger.info('Successfully deleted Google Calendar event', {
                route: 'visits/calendar-delete',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { visitID: id }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to delete calendar event', {
                route: 'visits/calendar-delete',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to delete calendar event' });
        }
    }
}

module.exports = VisitController;