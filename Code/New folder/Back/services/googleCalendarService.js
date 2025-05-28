const { google } = require('googleapis');
const { User, Visit, Reason, Checklist, Timesheet, Agent } = require('../models');
const GoogleMapsService = require('./googleMapsService');
const VaultService = require('./vaultService');
const RedisUtils = require('../utils/redisUtils');
const logger = require('../utils/logger');
require('dotenv').config();

function isValidDateTime(dateStr, timeStr) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
    return dateRegex.test(dateStr) && timeRegex.test(timeStr);
}

function normalizeTime(timeStr) {
    const match = timeStr.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
    if (match) {
        return `${match[1]}:${match[2]}`;
    }
    return timeStr;
}

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
            throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
        }
        const accessToken = await VaultService.getAccessToken(userId);
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        return google.calendar({ version: 'v3', auth: oauth2Client });
    }

    static async createCalendarEvent(userId, visitId, options = {}) {
        try {
            if (typeof userId !== 'string') {
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            if (typeof visitId !== 'string') {
                throw new Error(`Invalid visitId type: expected string, got ${typeof visitId}`);
            }

            const calendar = await this.getCalendarClient(userId);
            const visit = await Visit.findByPk(visitId, {
                include: [
                    { model: Agent },
                    { model: Timesheet, include: [{ model: User, include: [{ model: User, as: 'RegionalManager' }] }] },
                    { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                    { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } }
                ],
                transaction: options.transaction
            });
            if (!visit) {
                throw new Error('Visit not found');
            }
            if (!visit.Timesheet || !visit.Timesheet.User) {
                throw new Error('Visit has no associated timesheet or user');
            }

            if (visit.Timesheet.User.userID !== userId) {
                throw new Error(`User ${userId} is not authorized to create events for this visit`);
            }

            if (!isValidDateTime(visit.date, visit.time)) {
                throw new Error(`Invalid date (${visit.date}) or time (${visit.time}) format. Expected YYYY-MM-DD and HH:MM or HH:MM:SS.`);
            }

            const normalizedTime = normalizeTime(visit.time);
            const startDateTime = new Date(`${visit.date}T${normalizedTime}:00`);
            if (isNaN(startDateTime.getTime())) {
                throw new Error('Computed startDateTime is invalid');
            }
            const duration = Number(visit.duration) || 60;
            const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
            if (isNaN(endDateTime.getTime())) {
                throw new Error('Computed endDateTime is invalid');
            }

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
                    location = visit.location;
                }
            }

            let description = `Status: ${visit.status}\n`;
            if (visit.Reasons && visit.Reasons.length > 0) {
                description += `Reasons:\n${visit.Reasons.map(r => `- ${r.item}`).join('\n')}\n`;
            }
            if (visit.Checklists && visit.Checklists.length > 0) {
                description += `Checklists:\n${visit.Checklists.map(c => `- ${c.item}`).join('\n')}\n`;
            }
            if (visit.status === 'visited' && visit.photos && visit.photos.length > 0) {
                description += `Photos: ${visit.photos.length}\n`;
            }
            if (visit.status === 'visited' && visit.comment) {
                description += `Comment: ${visit.comment}`;
            }

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
                guestsCanModify: true,
                extendedProperties: {
                    private: {
                        visitId: visit.visitID,
                        timesheetId: visit.timesheetID,
                        agentPhone: visit.Agent?.phone || '',
                        lockedFields: 'true'
                    }
                }
            };

            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: event,
                sendUpdates: 'all'
            });

            if (visit.Timesheet.User.RegionalManager?.email) {
                try {
                    await calendar.acl.insert({
                        calendarId: 'primary',
                        resource: {
                            scope: { type: 'user', value: visit.Timesheet.User.RegionalManager.email },
                            role: 'writer'
                        }
                    });
                } catch (error) {
                    throw new Error(`Failed to set ACL for regional manager: ${error.message}`);
                }
            }

            visit.calendarEventId = response.data.id;
            await visit.save({ transaction: options.transaction });

            return response.data;
        } catch (error) {
            throw error;
        }
    }

    static async updateCalendarEvent(userId, visitId, options = {}) {
        try {
            if (typeof userId !== 'string') {
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            if (typeof visitId !== 'string') {
                throw new Error(`Invalid visitId type: expected string, got ${typeof visitId}`);
            }

            const calendar = await this.getCalendarClient(userId);
            const visit = await Visit.findByPk(visitId, {
                include: [
                    { model: Agent },
                    { model: Timesheet, include: [User] },
                    { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                    { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } }
                ],
                transaction: options.transaction
            });
            if (!visit || !visit.calendarEventId) {
                logger.error(`Visit not found or no calendar event associated for visitId: ${visitId}`);
                throw new Error('Visit not found or no calendar event associated');
            }
            if (!visit.Timesheet) {
                logger.error(`Timesheet not found for visit ${visitId}, timesheetID: ${visit.timesheetID}`);
                throw new Error('Timesheet not found');
            }
            if (!visit.Timesheet.User) {
                logger.error(`User not found for timesheet ${visit.timesheetID}, supervisorID: ${visit.Timesheet.supervisorID}`);
                throw new Error('Supervisor not found');
            }

            if (!isValidDateTime(visit.date, visit.time)) {
                throw new Error(`Invalid date (${visit.date}) or time (${visit.time}) format. Expected YYYY-MM-DD and HH:MM or HH:MM:SS.`);
            }

            const normalizedTime = normalizeTime(visit.time);
            const startDateTime = new Date(`${visit.date}T${normalizedTime}:00`);
            if (isNaN(startDateTime.getTime())) {
                throw new Error('Computed startDateTime is invalid');
            }

            const duration = Number(visit.duration) || 60;
            const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
            if (isNaN(endDateTime.getTime())) {
                throw new Error('Computed endDateTime is invalid');
            }

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
                    location = visit.location;
                }
            }

            let description = `Status: ${visit.status}`;
            if (visit.Reasons && visit.Reasons.length > 0) {
                description += `\n\nReasons:\n${visit.Reasons.map(r => `- ${r.item}`).join('\n')}`;
            }
            if (visit.Checklists && visit.Checklists.length > 0) {
                description += `\n\nChecklists:\n${visit.Checklists.map(c => `- ${c.item}`).join('\n')}`;
            }
            if (visit.status === 'visited' && visit.photos && visit.photos.length > 0) {
                description += `Photos: ${visit.photos.length}\n`;
            }
            if (visit.status === 'visited' && visit.comment) {
                description += `\n\nComment: ${visit.comment}`;
            }

            const event = {
                summary: `Visit: ${visit.Agent?.name || 'Unknown'} ${visit.Agent?.lastname || ''}`,
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

            return response.data;
        } catch (error) {
            throw error;
        }
    }

    static async deleteCalendarEvent(userId, visitId) {
        try {
            if (typeof userId !== 'string') {
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            if (typeof visitId !== 'string') {
                throw new Error(`Invalid visitId type: expected string, got ${typeof visitId}`);
            }

            const calendar = await this.getCalendarClient(userId);
            const visit = await Visit.findByPk(visitId);
            if (!visit || !visit.calendarEventId) {
                throw new Error('Visit not found or no calendar event associated');
            }

            await calendar.events.delete({
                calendarId: 'primary',
                eventId: visit.calendarEventId,
                sendUpdates: 'all'
            });

            visit.calendarEventId = null;
            await visit.save();

        } catch (error) {
            throw error;
        }
    }

    static async listCalendarEvents(userId, timesheetId) {
        try {
            if (typeof userId !== 'string') {
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            if (typeof timesheetId !== 'string') {
                throw new Error(`Invalid timesheetId type: expected string, got ${typeof timesheetId}`);
            }

            const calendar = await this.getCalendarClient(userId);
            const timesheet = await Timesheet.findByPk(timesheetId);
            if (!timesheet) {
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

            return response.data.items;
        } catch (error) {
            if (error.message.includes('Invalid Credentials') || error.response?.status === 401) {
                await VaultService.clearTokens(userId);
                throw new Error('Invalid Google Calendar credentials. Please re-authorize.');
            }
            throw error;
        }
    }

    static async notifyCalendarUpdate(userId, updateData) {
        try {
            if (typeof userId !== 'string') {
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            await RedisUtils.publishEvent('calendar_updates', { userId, ...updateData });
        } catch (error) {
            throw error;
        }
    }

    static async syncTimesheetToCalendar(userId, timesheetId) {
        try {
            if (typeof userId !== 'string') {
                throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
            }
            if (typeof timesheetId !== 'string') {
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
                    results.push({ visitId: visit.visitID, status: 'failed', error: error.message });
                }
            }
            return results;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = GoogleCalendarService;