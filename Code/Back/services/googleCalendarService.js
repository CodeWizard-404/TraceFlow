const { google } = require('googleapis');
const { User, Visit, Reason, Checklist, Timesheet, Agent } = require('../models');
const GoogleMapsService = require('./googleMapsService');
const VaultService = require('./vaultService');
const RedisUtils = require('../utils/redisUtils');
const logger = require('../utils/logger');
require('dotenv').config();

// Helper function to validate and normalize date and time
function isValidDateTime(dateStr, timeStr) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
    return dateRegex.test(dateStr) && timeRegex.test(timeStr);
}

// Helper function to normalize time to HH:MM
function normalizeTime(timeStr) {
    const match = timeStr.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
    if (match) {
        return `${match[1]}:${match[2]}`; // Return HH:MM
    }
    return timeStr; // Return unchanged if invalid (will be caught by validation)
}

// Helper function to get color ID based on status
function getColorId(status) {
    switch (status?.toLowerCase()) {
        case 'pending':
            return '5'; // Orange (#FFA500)
        case 'visited':
            return '7'; // Blue (#0000FF)
        case 'rejected':
            return '11'; // Red (#FF0000)
        case 'validated':
            return '10'; // Green (#008000)
        default:
            return '5'; // Default to orange for unknown status
    }
}

class GoogleCalendarService {
    static async getCalendarClient(userId) {
        if (typeof userId !== 'string') {
            logger.error('Invalid userId type', { userId: String(userId) });
            throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
        }
        const accessToken = await VaultService.getAccessToken(userId);
        logger.info('Retrieved access token from Vault', { userId });
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        return google.calendar({ version: 'v3', auth: oauth2Client });
    }

    static async createCalendarEvent(userId, visitId) {
        try {
            // Input validation
            if (typeof userId !== 'string') {
                logger.error('Invalid userId type', { userId: String(userId), visitId });
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            if (typeof visitId !== 'string') {
                logger.error('Invalid visitId type', { userId, visitId: String(visitId) });
                throw new Error(`Invalid visitId type: expected string, got ${typeof visitId}`);
            }

            // Fetch supervisor's calendar client
            const calendar = await this.getCalendarClient(userId);
            const visit = await Visit.findByPk(visitId, {
                include: [
                    { model: Agent },
                    { model: Timesheet, include: [{ model: User, include: [{ model: User, as: 'RegionalManager' }] }] },
                    { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                    { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } }
                ]
            });
            if (!visit) {
                logger.error('Visit not found', { userId, visitId });
                throw new Error('Visit not found');
            }
            if (!visit.Timesheet || !visit.Timesheet.User) {
                logger.error('Visit has no associated timesheet or user', { userId, visitId });
                throw new Error('Visit has no associated timesheet or user');
            }

            // Validate supervisor
            if (visit.Timesheet.User.userID !== userId) {
                logger.warn('User ID mismatch', {
                    userId,
                    visitId,
                    timesheetUserId: visit.Timesheet.User.userID
                });
            }

            // Validate date and time
            if (!isValidDateTime(visit.date, visit.time)) {
                logger.error('Invalid date or time format', {
                    userId,
                    visitId,
                    date: visit.date,
                    time: visit.time,
                });
                throw new Error(`Invalid date (${visit.date}) or time (${visit.time}) format. Expected YYYY-MM-DD and HH:MM or HH:MM:SS.`);
            }

            // Normalize time
            const normalizedTime = normalizeTime(visit.time);
            logger.debug('Normalized time', { userId, visitId, originalTime: visit.time, normalizedTime });

            // Construct start and end times
            const startDateTime = new Date(`${visit.date}T${normalizedTime}:00`);
            if (isNaN(startDateTime.getTime())) {
                logger.error('Invalid startDateTime computed', {
                    userId,
                    visitId,
                    date: visit.date,
                    time: normalizedTime,
                });
                throw new Error('Computed startDateTime is invalid');
            }
            const duration = Number(visit.duration) || 60;
            const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
            if (isNaN(endDateTime.getTime())) {
                logger.error('Invalid endDateTime computed', { userId, visitId, duration });
                throw new Error('Computed endDateTime is invalid');
            }

            // Get location
            let location = 'No location';
            let latitude = null;
            let longitude = null;
            if (visit.location) {
                try {
                    const geocode = await GoogleMapsService.geocodeAddress(visit.location, 'tn');
                    location = geocode.formattedAddress;
                    latitude = geocode.latitude;
                    longitude = geocode.longitude;
                } catch (error) {
                    logger.warn(`Failed to geocode location: ${error.message}`, { userId, visitId, location: visit.location });
                    location = visit.location;
                }
            }

            // Build description
            let description = `Status: ${visit.status}\n`;
            if (visit.Reasons && visit.Reasons.length > 0) {
                description += `Reasons:\n${visit.Reasons.map(r => `- ${r.item}`).join('\n')}\n`;
            }
            if (visit.Checklists && visit.Checklists.length > 0) {
                description += `Checklists:\n${visit.Checklists.map(c => `- ${c.item}`).join('\n')}\n`;
            }
            if (visit.status === 'visited' && visit.photos && visit.photos.length > 0) {
                description += `Photos:\n${visit.photos.map(p => `- ${p}`).join('\n')}\n`;
            }
            if (visit.status === 'visited' && visit.comment) {
                description += `Comment: ${visit.comment}`;
            }

            // Get attendees (supervisor and regional manager)
            const attendees = [{ email: visit.Timesheet.User.email }];
            if (visit.Timesheet.User.RegionalManager?.email) {
                attendees.push({ email: visit.Timesheet.User.RegionalManager.email });
            }

            const event = {
                summary: `Visit to ${visit.Agent?.name || 'Unknown'} ${visit.Agent?.lastname || ''}`,
                location: latitude && longitude ? `${latitude},${longitude}` : location,
                description,
                start: { dateTime: startDateTime.toISOString(), timeZone: 'Africa/Tunis' },
                end: { dateTime: endDateTime.toISOString(), timeZone: 'Africa/Tunis' },
                colorId: getColorId(visit.status),
                attendees,
                guestsCanModify: true, // Allow attendees to modify
                extendedProperties: {
                    private: {
                        visitId: visit.visitID,
                        timesheetId: visit.timesheetID,
                        agentPhone: visit.Agent?.phone || '',
                        lockedFields: 'true' // Custom flag to indicate restricted editing
                    }
                }
            };

            logger.debug('Creating calendar event', {
                userId,
                visitId,
                start: event.start,
                end: event.end,
                colorId: event.colorId,
                attendees: event.attendees
            });

            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: event,
                sendUpdates: 'all' // Notify attendees
            });

            // Set ACL for regional manager (if exists)
            if (visit.Timesheet.User.RegionalManager?.email) {
                try {
                    await calendar.acl.insert({
                        calendarId: 'primary',
                        resource: {
                            scope: { type: 'user', value: visit.Timesheet.User.RegionalManager.email },
                            role: 'writer'
                        }
                    });
                    logger.info(`Granted write access to regional manager`, {
                        userId,
                        visitId,
                        regionalManagerEmail: visit.Timesheet.User.RegionalManager.email
                    });
                } catch (error) {
                    logger.warn(`Failed to set ACL for regional manager: ${error.message}`, {
                        userId,
                        visitId,
                        regionalManagerEmail: visit.Timesheet.User.RegionalManager.email
                    });
                }
            }

            visit.calendarEventId = response.data.id;
            await visit.save();

            logger.info(`Created calendar event for visit ${visitId}`, { userId, eventId: response.data.id });
            return response.data;
        } catch (error) {
            logger.error(`Failed to create calendar event for visit ${visitId}: ${error.message}`, {
                userId,
                visitId,
                fullError: JSON.stringify(error, null, 2)
            });
            throw error;
        }
    }

    static async updateCalendarEvent(userId, visitId) {
        try {
            if (typeof userId !== 'string') {
                logger.error('Invalid userId type', { userId: String(userId), visitId });
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            if (typeof visitId !== 'string') {
                logger.error('Invalid visitId type', { userId, visitId: String(visitId) });
                throw new Error(`Invalid visitId type: expected string, got ${typeof visitId}`);
            }

            const calendar = await this.getCalendarClient(userId);
            const visit = await Visit.findByPk(visitId, {
                include: [
                    { model: Agent },
                    { model: Timesheet, include: [User] },
                    { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                    { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } }
                ]
            });
            if (!visit || !visit.calendarEventId) {
                logger.error('Visit not found or no calendar event associated', { userId, visitId });
                throw new Error('Visit not found or no calendar event associated');
            }
            if (!visit.Timesheet || !visit.Timesheet.User) {
                logger.error('Visit has no associated timesheet or user', { userId, visitId });
                throw new Error('Visit has no associated timesheet or user');
            }

            // Validate date and time
            if (!isValidDateTime(visit.date, visit.time)) {
                logger.error('Invalid date or time format', {
                    userId,
                    visitId,
                    date: visit.date,
                    time: visit.time,
                });
                throw new Error(`Invalid date (${visit.date}) or time (${visit.time}) format. Expected YYYY-MM-DD and HH:MM or HH:MM:SS.`);
            }

            // Normalize time to HH:MM
            const normalizedTime = normalizeTime(visit.time);
            logger.debug('Normalized time', { userId, visitId, originalTime: visit.time, normalizedTime });

            // Construct startDateTime
            const startDateTime = new Date(`${visit.date}T${normalizedTime}:00`);
            if (isNaN(startDateTime.getTime())) {
                logger.error('Invalid startDateTime computed', {
                    userId,
                    visitId,
                    date: visit.date,
                    time: normalizedTime,
                });
                throw new Error('Computed startDateTime is invalid');
            }

            // Construct endDateTime
            const duration = Number(visit.duration) || 60;
            const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
            if (isNaN(endDateTime.getTime())) {
                logger.error('Invalid endDateTime computed', {
                    userId,
                    visitId,
                    duration,
                });
                throw new Error('Computed endDateTime is invalid');
            }

            // Get location coordinates
            let location = 'No location';
            let latitude = null;
            let longitude = null;
            if (visit.location) {
                try {
                    const geocode = await GoogleMapsService.geocodeAddress(visit.location, 'tn');
                    location = geocode.formattedAddress;
                    latitude = geocode.latitude;
                    longitude = geocode.longitude;
                } catch (error) {
                    logger.warn(`Failed to geocode location: ${error.message}`, { userId, visitId, location: visit.location });
                    location = visit.location;
                }
            }

            // Build description with reasons, checklists, photos, and comments
            let description = `Status: ${visit.status}`;
            if (visit.Reasons && visit.Reasons.length > 0) {
                description += `\n\nReasons:\n${visit.Reasons.map(r => `- ${r.item}`).join('\n')}`;
            }
            if (visit.Checklists && visit.Checklists.length > 0) {
                description += `\n\nChecklists:\n${visit.Checklists.map(c => `- ${c.item}`).join('\n')}`;
            }
            if (visit.status === 'visited' && visit.photos && visit.photos.length > 0) {
                description += `\n\nPhotos:\n${visit.photos.map(p => `- ${p}`).join('\n')}`;
            }
            if (visit.status === 'visited' && visit.comment) {
                description += `\n\nComment: ${visit.comment}`;
            }

            const event = {
                summary: `Visit : ${visit.Agent?.name || 'Unknown'} ${visit.Agent?.lastname || ''}`,
                location: latitude && longitude ? `${latitude},${longitude}` : location,
                description,
                start: { dateTime: startDateTime.toISOString(), timeZone: 'Africa/Tunis' },
                end: { dateTime: endDateTime.toISOString(), timeZone: 'Africa/Tunis' },
                colorId: getColorId(visit.status),
                extendedProperties: {
                    private: {
                        visitId: visit.visitID,
                        timesheetId: visit.timesheetID,
                        agentPhone: visit.Agent?.phone || '',
                    },
                },
            };

            const response = await calendar.events.update({
                calendarId: 'primary',
                eventId: visit.calendarEventId,
                resource: event,
            });

            logger.info(`Updated calendar event for visit ${visitId}`, { userId, eventId: response.data.id });
            return response.data;
        } catch (error) {
            logger.error(`Failed to update calendar event for visit ${visitId}: ${error.message}`, { userId, visitId });
            throw error;
        }
    }

    static async deleteCalendarEvent(userId, visitId) {
        try {
            if (typeof userId !== 'string') {
                logger.error('Invalid userId type', { userId: String(userId), visitId });
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            if (typeof visitId !== 'string') {
                logger.error('Invalid visitId type', { userId, visitId: String(visitId) });
                throw new Error(`Invalid visitId type: expected string, got ${typeof visitId}`);
            }

            const calendar = await this.getCalendarClient(userId);
            const visit = await Visit.findByPk(visitId);
            if (!visit || !visit.calendarEventId) {
                logger.error('Visit not found or no calendar event associated', { userId, visitId });
                throw new Error('Visit not found or no calendar event associated');
            }

            await calendar.events.delete({
                calendarId: 'primary',
                eventId: visit.calendarEventId,
                sendUpdates: 'all'
            });

            visit.calendarEventId = null;
            await visit.save();

            logger.info(`Deleted calendar event for visit ${visitId}`, { userId });
        } catch (error) {
            logger.error(`Failed to delete calendar event for visit ${visitId}: ${error.message}`, { userId, visitId });
            throw error;
        }
    }

    static async listCalendarEvents(userId, timesheetId) {
        try {
            if (typeof userId !== 'string') {
                logger.error('Invalid userId type', { userId: String(userId), timesheetId });
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            if (typeof timesheetId !== 'string') {
                logger.error('Invalid timesheetId type', { userId, timesheetId: String(timesheetId) });
                throw new Error(`Invalid timesheetId type: expected string, got ${typeof timesheetId}`);
            }

            const calendar = await this.getCalendarClient(userId);
            const timesheet = await Timesheet.findByPk(timesheetId);
            if (!timesheet) {
                logger.error('Timesheet not found', { userId, timesheetId });
                throw new Error('Timesheet not found');
            }

            const startDate = new Date(timesheet.year, 0, 1 + (timesheet.weekNumber - 1) * 7);
            startDate.setDate(startDate.getDate() - startDate.getDay() + 1); // Monday
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6); // Sunday

            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: startDate.toISOString(),
                timeMax: endDate.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                privateExtendedProperty: `timesheetId=${timesheetId}`,
            });

            logger.info(`Listed calendar events for timesheet ${timesheetId}`, { userId });
            return response.data.items;
        } catch (error) {
            logger.error(`Failed to list calendar events for timesheet ${timesheetId}: ${error.message}`, { userId, timesheetId });
            throw error;
        }
    }

    static async notifyCalendarUpdate(userId, updateData) {
        try {
            if (typeof userId !== 'string') {
                logger.error('Invalid userId type', { userId: String(userId), updateData });
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            await RedisUtils.publishEvent('calendar_updates', { userId, ...updateData });
            logger.info(`Notified calendar update for user ${userId}`, { updateData });
        } catch (error) {
            logger.warn(`Failed to notify calendar update: ${error.message}`, { userId });
        }
    }

    static async syncTimesheetToCalendar(userId, timesheetId) {
        try {
            if (typeof userId !== 'string') {
                logger.error('Invalid userId type', { userId: String(userId), timesheetId });
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            if (typeof timesheetId !== 'string') {
                logger.error('Invalid timesheetId type', { userId, timesheetId: String(timesheetId) });
                throw new Error(`Invalid timesheetId type: expected string, got ${typeof timesheetId}`);
            }

            const calendar = await this.getCalendarClient(userId);
            const timesheet = await Timesheet.findByPk(timesheetId, {
                include: [
                    {
                        model: Visit,
                        include: [
                            Agent,
                            Timesheet,
                            { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                            { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } }
                        ]
                    }
                ],
            });
            if (!timesheet) {
                logger.error('Timesheet not found', { userId, timesheetId });
                throw new Error('Timesheet not found');
            }

            const results = [];
            for (const visit of timesheet.Visits) {
                try {
                    let event;
                    if (visit.calendarEventId) {
                        event = await this.updateCalendarEvent(userId, visit.visitID);
                        results.push({ visitId: visit.visitID, status: 'updated' });
                    } else {
                        event = await this.createCalendarEvent(userId, visit.visitID);
                        visit.calendarEventId = event.id;
                        await visit.save();
                        results.push({ visitId: visit.visitID, status: 'created' });
                    }
                } catch (error) {
                    logger.error(`Failed to sync visit ${visit.visitID}: ${error.message}`, { userId, visitId: visit.visitID });
                    results.push({ visitId: visit.visitID, status: 'failed', error: error.message });
                }
            }
            logger.info(`Synced timesheet ${timesheetId} to calendar`, { userId });
            return results;
        } catch (error) {
            logger.error(`Failed to sync timesheet ${timesheetId}: ${error.message}`, { userId, timesheetId });
            throw error;
        }
    }


}

module.exports = GoogleCalendarService;