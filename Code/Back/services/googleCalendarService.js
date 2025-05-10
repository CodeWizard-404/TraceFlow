const { google } = require('googleapis');
const { User, Visit, Timesheet, Agent } = require('../models');
const GoogleMapsService = require('./googleMapsService');
const logger = require('../utils/logger');
require('dotenv').config();

class GoogleCalendarService {
    static async getOAuth2Client(userId) {
        if (
            !process.env.GOOGLE_CALENDAR_CLIENT_ID ||
            !process.env.GOOGLE_CALENDAR_CLIENT_SECRET ||
            !process.env.GOOGLE_CALENDAR_REDIRECT_URI
        ) {
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
            logger.info(`Updated OAuth tokens for user ${userId}`);
        });

        return oauth2Client;
    }

    // List all calendar events for a user's timesheet
    static async listCalendarEvents(userId, timesheetId) {
        try {
            const oauth2Client = await this.getOAuth2Client(userId);
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const timesheet = await Timesheet.findByPk(timesheetId, {
                include: [{ model: Visit, include: [Agent] }],
            });
            if (!timesheet) {
                const error = new Error('Timesheet not found');
                error.status = 404;
                throw error;
            }

            const visits = timesheet.Visits || [];
            const events = [];

            for (const visit of visits) {
                if (visit.calendarEventId) {
                    try {
                        const event = await calendar.events.get({
                            calendarId: 'primary',
                            eventId: visit.calendarEventId,
                        });
                        const mapsLink = await this.generateMapsLink(visit.location);
                        events.push({
                            ...event.data,
                            visitId: visit.visitID,
                            mapsLink,
                        });
                    } catch (error) {
                        logger.warn(`Failed to fetch calendar event ${visit.calendarEventId}: ${error.message}`);
                    }
                }
            }

            return events;
        } catch (error) {
            logger.error(`Failed to list calendar events: ${error.message}`);
            throw new Error(`Failed to list calendar events: ${error.message}`);
        }
    }

    // Create a calendar event for a visit
    static async createCalendarEvent(userId, visitId) {
        try {
            const visit = await Visit.findByPk(visitId, { include: [Agent] });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }

            const agent = visit.Agent;
            const oauth2Client = await this.getOAuth2Client(userId);
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const startDateTime = new Date(`${visit.date}T${visit.time}Z`);
            const endDateTime = new Date(startDateTime.getTime() + (visit.duration || 60) * 60 * 1000);

            const mapsLink = await this.generateMapsLink(visit.location);

            const event = {
                summary: `TraceFlow Visit: ${visit.visitID}`,
                description: `Visit to agent ${agent.name} ${agent.lastname} (${agent.email})\nLocation: ${visit.location}\nNavigate: ${mapsLink}`,
                location: visit.location,
                start: {
                    dateTime: startDateTime.toISOString(),
                    timeZone: 'UTC',
                },
                end: {
                    dateTime: endDateTime.toISOString(),
                    timeZone: 'UTC',
                },
            };

            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: event,
            });

            visit.calendarEventId = response.data.id;
            await visit.save();

            return response.data;
        } catch (error) {
            logger.error(`Failed to create calendar event for visit ${visitId}: ${error.message}`);
            throw new Error(`Failed to create calendar event: ${error.message}`);
        }
    }

    // Update a calendar event for a visit
    static async updateCalendarEvent(userId, visitId) {
        try {
            const visit = await Visit.findByPk(visitId, { include: [Agent] });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            if (!visit.calendarEventId) {
                const error = new Error('No calendar event associated with this visit');
                error.status = 404;
                throw error;
            }

            const agent = visit.Agent;
            const oauth2Client = await this.getOAuth2Client(userId);
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const startDateTime = new Date(`${visit.date}T${visit.time}Z`);
            const endDateTime = new Date(startDateTime.getTime() + (visit.duration || 60) * 60 * 1000);

            const mapsLink = await this.generateMapsLink(visit.location);

            const event = {
                summary: `TraceFlow Visit: ${visit.visitID}`,
                description: `Visit to agent ${agent.name} ${agent.lastname} (${agent.email})\nLocation: ${visit.location}\nNavigate: ${mapsLink}`,
                location: visit.location,
                start: {
                    dateTime: startDateTime.toISOString(),
                    timeZone: 'UTC',
                },
                end: {
                    dateTime: endDateTime.toISOString(),
                    timeZone: 'UTC',
                },
            };

            const response = await calendar.events.update({
                calendarId: 'primary',
                eventId: visit.calendarEventId,
                resource: event,
            });

            return response.data;
        } catch (error) {
            logger.error(`Failed to update calendar event for visit ${visitId}: ${error.message}`);
            throw new Error(`Failed to update calendar event: ${error.message}`);
        }
    }

    // Delete a calendar event for a visit
    static async deleteCalendarEvent(userId, visitId) {
        try {
            const visit = await Visit.findByPk(visitId);
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            if (!visit.calendarEventId) {
                const error = new Error('No calendar event associated with this visit');
                error.status = 404;
                throw error;
            }

            const oauth2Client = await this.getOAuth2Client(userId);
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            await calendar.events.delete({
                calendarId: 'primary',
                eventId: visit.calendarEventId,
            });

            visit.calendarEventId = null;
            await visit.save();

            return { message: 'Calendar event deleted successfully' };
        } catch (error) {
            logger.error(`Failed to delete calendar event for visit ${visitId}: ${error.message}`);
            throw new Error(`Failed to delete calendar event: ${error.message}`);
        }
    }

    // Sync all visits in a timesheet to Google Calendar
    static async syncTimesheetToCalendar(userId, timesheetId) {
        try {
            const timesheet = await Timesheet.findByPk(timesheetId, {
                include: [{ model: Visit, include: [Agent] }],
            });
            if (!timesheet) {
                const error = new Error('Timesheet not found');
                error.status = 404;
                throw error;
            }

            const visits = timesheet.Visits || [];
            const results = [];

            for (const visit of visits) {
                if (!visit.calendarEventId) {
                    const event = await this.createCalendarEvent(userId, visit.visitID);
                    results.push({
                        visitId: visit.visitID,
                        calendarEventId: event.id,
                        status: 'created',
                    });
                } else {
                    const event = await this.updateCalendarEvent(userId, visit.visitID);
                    results.push({
                        visitId: visit.visitID,
                        calendarEventId: event.id,
                        status: 'updated',
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error(`Failed to sync timesheet ${timesheetId} to calendar: ${error.message}`);
            throw new Error(`Failed to sync timesheet to calendar: ${error.message}`);
        }
    }

    // Generate Google Maps link for navigation
    static async generateMapsLink(address) {
        try {
            const geocoded = await GoogleMapsService.geocodeAddress(address);
            if (!geocoded || !geocoded.geometry) {
                return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            }
            const { lat, lng } = geocoded.geometry.location;
            return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        } catch (error) {
            logger.warn(`Failed to generate Maps link for address ${address}: ${error.message}`);
            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        }
    }

    // Real-time synchronization via WebSocket
    static async notifyCalendarUpdate(userId, eventData) {
        const { Server } = require('socket.io');
        const axios = require('axios');
        const { User } = require('../models');
        require('dotenv').config();

        const io = new Server({
            cors: {
                origin: [process.env.FRONTEND_URL, process.env.FRONTEND_URL1],
                methods: ['GET', 'POST'],
                credentials: true,
            },
        });

        io.use(async (socket, next) => {
            const accessToken = socket.handshake.headers.cookie?.match(/accessToken=([^;]+)/)?.[1];
            if (!accessToken) return next(new Error('No token'));

            const response = await axios.post(
                `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/protocol/openid-connect/token/introspect`,
                new URLSearchParams({
                    token: accessToken,
                    client_id: process.env.KEYCLOAK_CLIENT_ID,
                    client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
                })
            );

            if (!response.data.active) return next(new Error('Invalid token'));
            const user = await User.findOne({ where: { keycloakId: response.data.sub } });
            if (!user) return next(new Error('User not found'));

            socket.user = {
                userID: user.userID,
                email: response.data.email,
                roles: response.data.realm_access?.roles || [],
            };
            next();
        });

        io.on('connection', (socket) => {
            socket.join(socket.user.userID); // Only join user-specific room

            socket.on('join', (room) => socket.join(room));
            socket.on('leave', (room) => socket.leave(room));
            socket.on('disconnect', () => {
                socket.rooms.forEach((room) => socket.leave(room));
            });
        });

        io.to(userId).emit('calendar:update', eventData);
        logger.info(`Notified user ${userId} of calendar update`, { eventData });
    }
}

module.exports = GoogleCalendarService;