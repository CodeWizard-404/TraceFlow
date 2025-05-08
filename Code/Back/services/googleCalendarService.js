const { google } = require('googleapis');
const { User, Visit } = require('../models');
const logger = require('../utils/logger');
require('dotenv').config();

class GoogleCalendarService {
    static async getOAuth2Client(userId) {
        if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET || !process.env.GOOGLE_CALENDAR_REDIRECT_URI) {
            logger.warn('Google Calendar API credentials are missing. Calendar features are disabled.');
            throw new Error('Google Calendar API credentials are not configured');
        }

        const user = await User.findByPk(userId);
        if (!user || !user.googleAccessToken || !user.googleRefreshToken) {
            const error = new Error('Google OAuth tokens not found for user');
            error.status = 401;
            throw error;
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
            if (tokens.access_token) {
                user.googleAccessToken = tokens.access_token;
            }
            if (tokens.refresh_token) {
                user.googleRefreshToken = tokens.refresh_token;
            }
            await user.save();
            logger.info(`Refreshed Google OAuth tokens for user ${userId}`);
        });

        return oauth2Client;
    }

    static async createCalendarEvent(userId, visitId) {
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            logger.warn('Google Maps API key is missing. Skipping calendar event creation.');
            return { message: 'Calendar event creation skipped due to missing API key' };
        }

        try {
            const visit = await Visit.findByPk(visitId);
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }

            const oauth2Client = await this.getOAuth2Client(userId);
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const event = {
                summary: `TraceFlow Visit: ${visitId}`,
                description: `Visit scheduled for agent ${visit.agentID}`,
                start: {
                    dateTime: visit.date,
                    timeZone: 'UTC',
                },
                end: {
                    dateTime: new Date(new Date(visit.date).getTime() + (visit.duration || 60) * 60 * 1000).toISOString(),
                    timeZone: 'UTC',
                },
            };

            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: event,
            });

            const user = await User.findByPk(userId);
            user.googleCalendarId = response.data.id;
            await user.save();

            logger.info(`Created Google Calendar event for visit ${visitId} by user ${userId}`);
            return response.data;
        } catch (error) {
            logger.error(`Create calendar event error: ${error.message}`);
            throw new Error(`Failed to create calendar event: ${error.message}`);
        }
    }

    static async updateCalendarEvent(userId, visitId) {
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            logger.warn('Google Maps API key is missing. Skipping calendar event update.');
            return { message: 'Calendar event update skipped due to missing API key' };
        }

        try {
            const visit = await Visit.findByPk(visitId);
            const user = await User.findByPk(userId);
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            if (!user.googleCalendarId) {
                const error = new Error('No calendar event associated with this visit');
                error.status = 404;
                throw error;
            }

            const oauth2Client = await this.getOAuth2Client(userId);
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const event = {
                summary: `TraceFlow Visit: ${visitId}`,
                description: `Visit scheduled for agent ${visit.agentID}`,
                start: {
                    dateTime: visit.date,
                    timeZone: 'UTC',
                },
                end: {
                    dateTime: new Date(new Date(visit.date).getTime() + (visit.duration || 60) * 60 * 1000).toISOString(),
                    timeZone: 'UTC',
                },
            };

            const response = await calendar.events.update({
                calendarId: 'primary',
                eventId: user.googleCalendarId,
                resource: event,
            });

            logger.info(`Updated Google Calendar event for visit ${visitId} by user ${userId}`);
            return response.data;
        } catch (error) {
            logger.error(`Update calendar event error: ${error.message}`);
            throw new Error(`Failed to update calendar event: ${error.message}`);
        }
    }

    static async deleteCalendarEvent(userId, visitId) {
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            logger.warn('Google Maps API key is missing. Skipping calendar event deletion.');
            return { message: 'Calendar event deletion skipped due to missing API key' };
        }

        try {
            const user = await User.findByPk(userId);
            if (!user.googleCalendarId) {
                const error = new Error('No calendar event associated with this visit');
                error.status = 404;
                throw error;
            }

            const oauth2Client = await this.getOAuth2Client(userId);
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            await calendar.events.delete({
                calendarId: 'primary',
                eventId: user.googleCalendarId,
            });

            user.googleCalendarId = null;
            await user.save();

            logger.info(`Deleted Google Calendar event for visit ${visitId} by user ${userId}`);
            return { message: 'Calendar event deleted successfully' };
        } catch (error) {
            logger.error(`Delete calendar event error: ${error.message}`);
            throw new Error(`Failed to delete calendar event: ${error.message}`);
        }
    }
}

module.exports = GoogleCalendarService;