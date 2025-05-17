const { google } = require('googleapis');
const { User, Visit, Timesheet, Agent } = require('../models');
const GoogleMapsService = require('./googleMapsService');
const RedisUtils = require('../utils/redisUtils');
const logger = require('../utils/logger');
require('dotenv').config();

class GoogleCalendarService {
    static async getCalendarClient(userId) {
        const user = await User.findByPk(userId);
        if (!user || !user.googleAccessToken) {
            throw new Error('User not found or not authenticated with Google');
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CALENDAR_CLIENT_ID,
            process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
            process.env.GOOGLE_CALENDAR_REDIRECT_URI
        );

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken,
        });

        oauth2Client.on('tokens', async (tokens) => {
            if (tokens.refresh_token) user.googleRefreshToken = tokens.refresh_token;
            user.googleAccessToken = tokens.access_token;
            await user.save();
        });

        return google.calendar({ version: 'v3', auth: oauth2Client });
    }

    static async createCalendarEvent(userId, visitId) {
        const calendar = await this.getCalendarClient(userId);
        const visit = await Visit.findByPk(visitId, { include: [{ model: Agent }, { model: Timesheet }] });
        if (!visit) throw new Error('Visit not found');

        const startDateTime = new Date(`${visit.date}T${visit.time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + (visit.duration || 60) * 60000);
        const mapLink = visit.location ? await GoogleMapsService.getMapLink(visit.location) : 'No location';

        const event = {
            summary: `Visit to ${visit.Agent.name} ${visit.Agent.lastname}`,
            location: mapLink,
            description: `Visit ID: ${visit.visitID}\nAgent: ${visit.Agent.name} ${visit.Agent.lastname}`,
            start: { dateTime: startDateTime.toISOString(), timeZone: 'Africa/Tunis' },
            end: { dateTime: endDateTime.toISOString(), timeZone: 'Africa/Tunis' },
            extendedProperties: {
                private: {
                    visitId: visit.visitID,
                    timesheetId: visit.timesheetID,
                },
            },
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });

        visit.calendarEventId = response.data.id;
        await visit.save();
        return response.data;
    }

    static async updateCalendarEvent(userId, visitId) {
        const calendar = await this.getCalendarClient(userId);
        const visit = await Visit.findByPk(visitId, { include: [{ model: Agent }, { model: Timesheet }] });
        if (!visit || !visit.calendarEventId) throw new Error('Visit not found or no calendar event associated');

        const startDateTime = new Date(`${visit.date}T${visit.time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + (visit.duration || 60) * 60000);
        const mapLink = visit.location ? await GoogleMapsService.getMapLink(visit.location) : 'No location';

        const event = {
            summary: `Visit to ${visit.Agent.name} ${visit.Agent.lastname}`,
            location: mapLink,
            description: `Visit ID: ${visit.visitID}\nAgent: ${visit.Agent.name} ${visit.Agent.lastname}`,
            start: { dateTime: startDateTime.toISOString(), timeZone: 'Africa/Tunis' },
            end: { dateTime: endDateTime.toISOString(), timeZone: 'Africa/Tunis' },
            extendedProperties: {
                private: {
                    visitId: visit.visitID,
                    timesheetId: visit.timesheetID,
                },
            },
        };

        const response = await calendar.events.update({
            calendarId: 'primary',
            eventId: visit.calendarEventId,
            resource: event,
        });
        return response.data;
    }

    static async deleteCalendarEvent(userId, visitId) {
        const calendar = await this.getCalendarClient(userId);
        const visit = await Visit.findByPk(visitId);
        if (!visit || !visit.calendarEventId) throw new Error('Visit not found or no calendar event associated');

        await calendar.events.delete({
            calendarId: 'primary',
            eventId: visit.calendarEventId,
        });

        visit.calendarEventId = null;
        await visit.save();
    }

    static async listCalendarEvents(userId, timesheetId) {
        const calendar = await this.getCalendarClient(userId);
        const timesheet = await Timesheet.findByPk(timesheetId);
        if (!timesheet) throw new Error('Timesheet not found');

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
    }

    static async notifyCalendarUpdate(userId, updateData) {
        try {
            await RedisUtils.publishEvent('calendar_updates', { userId, ...updateData });
        } catch (error) {
            logger.warn(`Failed to notify calendar update: ${error.message}`);
        }
    }
}

module.exports = GoogleCalendarService;