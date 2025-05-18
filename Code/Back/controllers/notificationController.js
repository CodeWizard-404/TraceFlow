const { validationResult } = require('express-validator');
const { NotificationRule, NotificationPreference, Notification } = require('../models');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const RedisUtils = require('../utils/redisUtils');

const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    SERVER_ERROR: 'Something broke. Try again later.',
    INVALID_RULE: 'Invalid notification rule.',
    INVALID_PREFERENCES: 'Invalid notification preferences.',
    INVALID_CHANNELS: 'Channels must only include email, sms, and inApp.',
    INVALID_PRIORITY: 'Priority must be "high" or "normal".',
};

class NotificationController {
    static formatError(error) {
        return {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
        };
    }

    static async createRule(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { event, type, recipients, channels, conditions, messageTemplate, enabled, priority } = req.body;

            // Validate channels
            if (channels.websocket !== undefined) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_CHANNELS), { status: 400 });
            }
            if (!['email', 'sms', 'inApp'].every(c => typeof channels[c] === 'boolean')) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_CHANNELS), { status: 400 });
            }

            // Validate priority
            if (priority && !['high', 'normal'].includes(priority)) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_PRIORITY), { status: 400 });
            }

            const rule = await NotificationRule.create({
                event,
                type,
                recipients,
                channels,
                conditions,
                messageTemplate,
                enabled: enabled !== undefined ? enabled : true,
                priority: priority || 'normal',
                creatorID: req.user.userID,
            });

            // Handle priority change if high
            if (rule.priority === 'high') {
                await NotificationService.handlePriorityChange(rule);
            }

            logger.info('Successfully created notification rule', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status: 201,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { ruleID: rule.ruleID, priority: rule.priority },
            });
            return res.status(201).json(rule);
        } catch (error) {
            const response = NotificationController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ||
                error.message === ERROR_MESSAGES.INVALID_CHANNELS ||
                error.message === ERROR_MESSAGES.INVALID_PRIORITY ? 400 : error.status || 500;
            logger.error('Failed to create notification rule', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async updateRule(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { ruleID } = req.params;
            const { event, type, recipients, channels, conditions, messageTemplate, enabled, priority } = req.body;

            // Validate channels
            if (channels.websocket !== undefined) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_CHANNELS), { status: 400 });
            }
            if (!['email', 'sms', 'inApp'].every(c => typeof channels[c] === 'boolean')) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_CHANNELS), { status: 400 });
            }

            // Validate priority
            if (priority && !['high', 'normal'].includes(priority)) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_PRIORITY), { status: 400 });
            }

            const rule = await NotificationRule.findByPk(ruleID);
            if (!rule) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_RULE), { status: 404 });
            }

            const wasNormalPriority = rule.priority === 'normal';
            await rule.update({
                event,
                type,
                recipients,
                channels,
                conditions,
                messageTemplate,
                enabled,
                priority: priority || rule.priority,
            });

            // Handle priority change if changed to high
            if (wasNormalPriority && rule.priority === 'high') {
                await NotificationService.handlePriorityChange(rule);
            }

            logger.info('Successfully updated notification rule', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { ruleID, priority: rule.priority },
            });
            return res.status(200).json(rule);
        } catch (error) {
            const response = NotificationController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ||
                error.message === ERROR_MESSAGES.INVALID_CHANNELS ||
                error.message === ERROR_MESSAGES.INVALID_PRIORITY ? 400 : error.status || 500;
            logger.error('Failed to update notification rule', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async deleteRule(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { ruleID } = req.params;
            const rule = await NotificationRule.findByPk(ruleID);
            if (!rule) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_RULE), { status: 404 });
            }
            await rule.destroy();
            logger.info('Successfully deleted notification rule', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { ruleID },
            });
            return res.status(200).json({ message: 'Notification rule deleted successfully.' });
        } catch (error) {
            const response = NotificationController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logger.error('Failed to delete notification rule', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async getRules(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const rules = await NotificationRule.findAll();
            logger.info('Successfully fetched notification rules', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { ruleCount: rules.length },
            });
            return res.status(200).json(rules);
        } catch (error) {
            const response = NotificationController.formatError(error);
            logger.error('Failed to fetch notification rules', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(500).json(response);
        }
    }

    static async getNotificationTypes(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const rules = await NotificationRule.findAll({
                attributes: ['type'],
                group: ['type'],
            });
            const types = rules.map(rule => rule.type);
            logger.info('Successfully fetched notification types', {
                route: 'notifications/types',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { typeCount: types.length },
            });
            return res.status(200).json({ types });
        } catch (error) {
            const response = NotificationController.formatError(error);
            logger.error('Failed to fetch notification types', {
                route: 'notifications/types',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(500).json(response);
        }
    }

    static async updatePreferences(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { preferences } = req.body;

            // Validate preferences and check for high-priority rules
            const rules = await NotificationRule.findAll({ where: { priority: 'high' } });
            const highPriorityEvents = rules.map(rule => rule.event);
            for (const event of Object.keys(preferences)) {
                if (highPriorityEvents.includes(event)) {
                    throw Object.assign(new Error(`Cannot customize preferences for high-priority event: ${event}`), { status: 400 });
                }
                const channels = preferences[event];
                if (typeof channels !== 'object' ||
                    !['email', 'sms', 'inApp'].every(c => typeof channels[c] === 'boolean') ||
                    channels.websocket !== undefined) {
                    throw Object.assign(new Error(ERROR_MESSAGES.INVALID_PREFERENCES), { status: 400 });
                }
            }

            let preference = await NotificationPreference.findOne({ where: { userID: req.user.userID } });
            if (!preference) {
                preference = await NotificationPreference.create({
                    userID: req.user.userID,
                    preferences: {},
                });
            }
            const currentPreferences = preference.preferences || {};
            const updatedPreferences = { ...currentPreferences };
            for (const [event, channels] of Object.entries(preferences)) {
                updatedPreferences[event] = {
                    email: channels.email,
                    sms: channels.sms,
                    inApp: channels.inApp,
                };
            }
            await preference.update({ preferences: updatedPreferences });
            await RedisUtils.storeUserPreferences(req.user.userID, updatedPreferences);
            logger.info('Successfully updated notification preferences', {
                route: 'notifications/preferences',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: req.user.userID },
            });
            return res.status(200).json(preference);
        } catch (error) {
            const response = NotificationController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ||
                error.message === ERROR_MESSAGES.INVALID_PREFERENCES ||
                error.message.includes('Cannot customize preferences') ? 400 : error.status || 500;
            logger.error('Failed to update notification preferences', {
                route: 'notifications/preferences',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async getPreferences(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const preference = await NotificationPreference.findOne({ where: { userID: req.user.userID } });
            const rules = await NotificationRule.findAll({
                attributes: ['event', 'priority'],
                group: ['event', 'priority'],
            });
            const availableEvents = rules.map(rule => ({
                event: rule.event,
                isCustomizable: rule.priority !== 'high',
            }));
            const defaultPrefs = availableEvents.reduce((acc, { event }) => {
                acc[event] = { email: true, sms: true, inApp: true };
                return acc;
            }, {});
            const preferences = preference && preference.preferences ? { ...defaultPrefs, ...preference.preferences } : defaultPrefs;
            const sanitizedPreferences = {};
            for (const [event, channels] of Object.entries(preferences)) {
                sanitizedPreferences[event] = {
                    email: channels.email,
                    sms: channels.sms,
                    inApp: channels.inApp,
                };
            }
            logger.info('Successfully fetched notification preferences', {
                route: 'notifications/preferences',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: req.user.userID, eventCount: availableEvents.length },
            });
            return res.status(200).json({ preferences: sanitizedPreferences, availableEvents });
        } catch (error) {
            const response = NotificationController.formatError(error);
            logger.error('Failed to fetch notification preferences', {
                route: 'notifications/preferences',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(500).json(response);
        }
    }

    static async getNotifications(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const notifications = await Notification.findAll({
                where: { userID: req.user.userID },
                order: [['createdAt', 'DESC']],
            });
            logger.info('Successfully fetched notifications', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: req.user.userID, notificationCount: notifications.length },
            });
            return res.status(200).json(notifications);
        } catch (error) {
            const response = NotificationController.formatError(error);
            logger.error('Failed to fetch notifications', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(500).json(response);
        }
    }

    static async markNotificationAsRead(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { notificationID } = req.params;
            const notification = await Notification.findByPk(notificationID);
            if (!notification || notification.userID !== req.user.userID) {
                throw Object.assign(new Error('Notification not found or unauthorized'), { status: 404 });
            }
            await notification.update({ status: 'read' });
            logger.info('Successfully marked notification as read', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { notificationID },
            });
            return res.status(200).json(notification);
        } catch (error) {
            const response = NotificationController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logger.error('Failed to mark notification as read', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async markAllNotificationsAsRead(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const updatedCount = await Notification.update(
                { status: 'read' },
                {
                    where: {
                        userID: req.user.userID,
                        status: { [require('sequelize').Op.in]: ['pending', 'sent'] },
                    },
                }
            );
            logger.info('Successfully marked all notifications as read', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: req.user.userID, updatedCount: updatedCount[0] },
            });
            return res.status(200).json({ message: `Marked ${updatedCount[0]} notifications as read.` });
        } catch (error) {
            const response = NotificationController.formatError(error);
            logger.error('Failed to mark all notifications as read', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(500).json(response);
        }
    }

    static async createNotification(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { event, data, roles, userIDs, type, message, email, sms } = req.body;
            const results = await NotificationService.sendNotification({
                event,
                data,
                roles: roles || [],
                userIDs: userIDs || [],
                type,
                message,
                email,
                sms,
            });
            logger.info('Successfully created notification', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { event, type },
            });
            return res.status(200).json({ results, message: 'Notification sent successfully.' });
        } catch (error) {
            const response = NotificationController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logger.error('Failed to create notification', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async notifyAnomaly(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { dataType, anomalies, userIDs, roles } = req.body;
            const results = await NotificationService.triggerNotification({
                event: 'ai:anomaly_detected',
                data: { dataType, anomalyCount: anomalies.length },
                metadata: { triggeredBy: req.user.email, anomalies },
                roles: roles || [],
                userIDs: userIDs || [],
            });
            logger.info('Successfully triggered anomaly notification', {
                route: 'notifications/anomaly',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { dataType, anomalyCount: anomalies.length },
            });
            return res.status(200).json({ results, message: 'Anomaly notification sent successfully.' });
        } catch (error) {
            const response = NotificationController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logger.error('Failed to trigger anomaly notification', {
                route: 'notifications/anomaly',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }

    static async notifyReport(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }
            const { format, filters, userIDs, roles } = req.body;
            const results = await NotificationService.triggerNotification({
                event: 'ai:report_generated',
                data: { format, filters },
                metadata: { triggeredBy: req.user.email },
                roles: roles || [],
                userIDs: userIDs || [],
            });
            logger.info('Successfully triggered report notification', {
                route: 'notifications/report',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { format },
            });
            return res.status(200).json({ results, message: 'Report notification sent successfully.' });
        } catch (error) {
            const response = NotificationController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logger.error('Failed to trigger report notification', {
                route: 'notifications/report',
                method: req.method,
                url: req.originalUrl,
                status,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: response.error },
            });
            return res.status(status).json(response);
        }
    }
}

module.exports = NotificationController;