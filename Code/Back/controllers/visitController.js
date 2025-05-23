const VisitService = require('../services/visitService');
const GoogleCalendarService = require('../services/googleCalendarService');
const VaultService = require('../services/vaultService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { Visit, Timesheet, User, Reason, Checklist, Agent } = require('../models');

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
                if (!timesheet || !timesheet.User) {
                    throw new Error('Timesheet or supervisor not found');
                }
                const event = await GoogleCalendarService.updateCalendarEvent(timesheet.User.userID, id);
                await GoogleCalendarService.notifyCalendarUpdate(timesheet.User.userID, {
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
        try {
            const { id } = req.params;
            const { date, time, duration, location, status, comment, agentID, checklists, reasons, photosToRemove, supervisorID } = req.body;
            const files = req.files || [];
            if (!id) {
                logger.warn(`Update visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await VisitService.updateVisit(id, { date, time, duration, location, status, comment, agentID, checklists, reasons, photosToRemove, supervisorID }, files, req.user.userID);
            try {
                const timesheet = await Timesheet.findByPk(visit.timesheetID, { include: [{ model: User }] });
                if (!timesheet || !timesheet.User) {
                    throw new Error('Timesheet or supervisor not found');
                }
                const event = await GoogleCalendarService.updateCalendarEvent(timesheet.User.userID, id);
                await GoogleCalendarService.notifyCalendarUpdate(timesheet.User.userID, {
                    visitId: id,
                    calendarEventId: event.id,
                    action: 'updated',
                });
            } catch (error) {
                logger.warn(`Failed to update calendar event for visit ${id}: ${error.message}`);
            }
            await NotificationService.triggerNotification({
                event: 'visit:updated',
                data: { visitId: id, updates: Object.keys(req.body), status },
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
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await Visit.findByPk(id, { include: [{ model: Timesheet, include: [{ model: User }] }] });
            if (!visit) {
                logger.warn(`Delete visit failed: Visit not found, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(404).json({ error: 'Visit not found' });
            }
            const result = await VisitService.deleteVisit(id, req.user.userID);
            try {
                if (visit.Timesheet.User) {
                    await GoogleCalendarService.deleteCalendarEvent(visit.Timesheet.User.userID, id);
                    await GoogleCalendarService.notifyCalendarUpdate(visit.Timesheet.User.userID, {
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

            logger.error(`Sync visit to calendar error: ${error.message}`, { userID: req.user.userID, IP: req.ip, visitId: req.params.visitId });
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
            if (!timesheet || !timesheet.User) {
                throw new Error('Timesheet or supervisor not found');
            }
            const events = await GoogleCalendarService.listCalendarEvents(timesheet.User.userID, timesheetId);
            logger.info(`Listed calendar events for timesheet ${timesheetId} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(events);
        } catch (error) {
            logger.error(`List calendar events error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to list calendar events' });
        }
    }



    static async handleCalendarWebhook(req, res) {
        try {
            const userId = req.headers['x-goog-resource-token'];
            const eventId = req.body?.resourceId;
            if (!userId || !eventId) {
                logger.warn('Invalid webhook payload', { headers: req.headers, body: req.body });
                return res.status(400).json({ error: 'Invalid webhook payload' });
            }

            const calendar = await GoogleCalendarService.getCalendarClient(userId);
            const event = await calendar.events.get({
                calendarId: 'primary',
                eventId
            });

            const visitId = event.data.extendedProperties?.private?.visitId;
            if (!visitId) {
                logger.debug('Non-visit event modified, ignoring', { userId, eventId });
                return res.status(200).json({ message: 'Ignored' });
            }

            const visit = await Visit.findByPk(visitId, {
                include: [
                    { model: Agent },
                    { model: Timesheet, include: [User] },
                    { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                    { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } }
                ]
            });
            if (!visit) {
                logger.warn('Visit not found for event', { userId, visitId, eventId });
                return res.status(404).json({ error: 'Visit not found' });
            }

            // Check if restricted fields were modified
            const expectedDescription = `Status: ${visit.status}\n` +
                (visit.Reasons?.length ? `Reasons:\n${visit.Reasons.map(r => `- ${r.item}`).join('\n')}\n` : '') +
                (visit.Checklists?.length ? `Checklists:\n${visit.Checklists.map(c => `- ${c.item}`).join('\n')}\n` : '') +
                (visit.status === 'visited' && visit.photos?.length ? `Photos:\n${visit.photos.map(p => `- ${p}`).join('\n')}\n` : '') +
                (visit.status === 'visited' && visit.comment ? `Comment: ${visit.comment}` : '');

            const expectedSummary = `Visit to ${visit.Agent?.name || 'Unknown'} ${visit.Agent?.lastname || ''}`;
            const isLocked = event.data.extendedProperties?.private?.lockedFields === 'true';

            if (isLocked && (
                event.data.summary !== expectedSummary ||
                event.data.description !== expectedDescription ||
                event.data.location !== (visit.latitude && visit.longitude ? `${visit.latitude},${visit.longitude}` : visit.location)
            )) {
                logger.warn('Unauthorized changes detected, reverting event', { userId, visitId, eventId });
                await GoogleCalendarService.updateCalendarEvent(userId, visitId);
                return res.status(200).json({ message: 'Reverted unauthorized changes' });
            }

            // Update visit date/time if changed
            const newStart = new Date(event.data.start.dateTime);
            const newEnd = new Date(event.data.end.dateTime);
            visit.date = newStart.toISOString().split('T')[0];
            visit.time = newStart.toTimeString().slice(0, 5);
            visit.duration = Math.round((newEnd - newStart) / 60000);
            await visit.save();

            logger.info('Processed calendar event update', { userId, visitId, eventId });
            return res.status(200).json({ message: 'Processed' });
        } catch (error) {
            logger.error(`Webhook processing error: ${error.message}`, { userId: req.headers['x-goog-resource-token'] });
            return res.status(500).json({ error: 'Failed to process webhook' });
        }
    }


}

module.exports = VisitController;