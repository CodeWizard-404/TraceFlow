const { NotificationRule, NotificationPreference, Notification } = require('../models');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const RedisUtils = require('../utils/redisUtils');

class NotificationController {
    static async createRule(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { event, type, recipients, channels, conditions, messageTemplate, enabled } = req.body;
            if (!event || !type || !recipients || !channels || !messageTemplate) {
                logger.warn('Create notification rule failed: Missing required fields', {
                    route: 'notifications/rules',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'All required fields must be provided.' });
            }
            const rule = await NotificationRule.create({
                event,
                type,
                recipients,
                channels,
                conditions,
                messageTemplate,
                enabled: enabled !== undefined ? enabled : true,
                creatorID: req.user.userID,
            });
            logger.info('Successfully created notification rule', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status: 201,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { ruleID: rule.ruleID }
            });
            return res.status(201).json(rule);
        } catch (error) {
            logger.error('Failed to create notification rule', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to create notification rule.' });
        }
    }

    static async updateRule(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { ruleID } = req.params;
            const { event, type, recipients, channels, conditions, messageTemplate, enabled } = req.body;
            if (!ruleID) {
                logger.warn('Update notification rule failed: Missing ruleID', {
                    route: 'notifications/rules',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Rule ID is required.' });
            }
            const rule = await NotificationRule.findByPk(ruleID);
            if (!rule) {
                logger.warn('Update notification rule failed: Rule not found', {
                    route: 'notifications/rules',
                    method: req.method,
                    url: req.originalUrl,
                    status: 404,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { ruleID }
                });
                return res.status(404).json({ error: 'Notification rule not found.' });
            }
            await rule.update({
                event,
                type,
                recipients,
                channels,
                conditions,
                messageTemplate,
                enabled
            });
            logger.info('Successfully updated notification rule', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { ruleID }
            });
            return res.status(200).json(rule);
        } catch (error) {
            logger.error('Failed to update notification rule', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to update notification rule.' });
        }
    }

    static async deleteRule(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { ruleID } = req.params;
            if (!ruleID) {
                logger.warn('Delete notification rule failed: Missing ruleID', {
                    route: 'notifications/rules',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Rule ID is required.' });
            }
            const rule = await NotificationRule.findByPk(ruleID);
            if (!rule) {
                logger.warn('Delete notification rule failed: Rule not found', {
                    route: 'notifications/rules',
                    method: req.method,
                    url: req.originalUrl,
                    status: 404,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { ruleID }
                });
                return res.status(404).json({ error: 'Notification rule not found.' });
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
                metadata: { ruleID }
            });
            return res.status(200).json({ message: 'Notification rule deleted successfully.' });
        } catch (error) {
            logger.error('Failed to delete notification rule', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to delete notification rule.' });
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
                metadata: { ruleCount: rules.length }
            });
            return res.status(200).json(rules);
        } catch (error) {
            logger.error('Failed to fetch notification rules', {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to fetch notification rules.' });
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
                metadata: { typeCount: types.length }
            });
            return res.status(200).json({ types });
        } catch (error) {
            logger.error('Failed to fetch notification types', {
                route: 'notifications/types',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to fetch notification types.' });
        }
    }

    static async updatePreferences(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { preferences } = req.body;
            if (!preferences || typeof preferences !== 'object') {
                logger.warn('Update notification preferences failed: Invalid preferences', {
                    route: 'notifications/preferences',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Preferences must be a valid object.' });
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
                if (typeof channels !== 'object' || !['email', 'sms', 'inApp'].every(c => typeof channels[c] === 'boolean')) {
                    logger.warn('Update notification preferences failed: Invalid channel settings', {
                        route: 'notifications/preferences',
                        method: req.method,
                        url: req.originalUrl,
                        status: 400,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID,
                        metadata: { event }
                    });
                    return res.status(400).json({ error: `Invalid channel settings for event ${event}.` });
                }
                updatedPreferences[event] = {
                    email: channels.email,
                    sms: channels.sms,
                    inApp: channels.inApp,
                };
            }

            await preference.update({ preferences: updatedPreferences });
            await RedisUtils.storeUserPreferences(req.user.userID, updatedPreferences); // Update cache

            logger.info('Successfully updated notification preferences', {
                route: 'notifications/preferences',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: req.user.userID }
            });
            return res.status(200).json(preference);
        } catch (error) {
            logger.error('Failed to update notification preferences', {
                route: 'notifications/preferences',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to update notification preferences.' });
        }
    }

    static async getPreferences(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const preference = await NotificationPreference.findOne({ where: { userID: req.user.userID } });
            const rules = await NotificationRule.findAll({
                attributes: ['event'],
                group: ['event'],
            });
            const availableEvents = rules.map(rule => rule.event);

            const defaultPrefs = availableEvents.reduce((acc, event) => {
                acc[event] = { email: true, sms: true, inApp: true };
                return acc;
            }, {});

            const preferences = preference && preference.preferences ? { ...defaultPrefs, ...preference.preferences } : defaultPrefs;

            logger.info('Successfully fetched notification preferences', {
                route: 'notifications/preferences',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID: req.user.userID, eventCount: availableEvents.length }
            });
            return res.status(200).json({ preferences, availableEvents });
        } catch (error) {
            logger.error('Failed to fetch notification preferences', {
                route: 'notifications/preferences',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to fetch notification preferences.' });
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
                metadata: { userID: req.user.userID, notificationCount: notifications.length }
            });
            return res.status(200).json(notifications);
        } catch (error) {
            logger.error('Failed to fetch notifications', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to fetch notifications.' });
        }
    }

    static async markNotificationAsRead(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { notificationID } = req.params;
            if (!notificationID) {
                logger.warn('Mark notification as read failed: Missing notificationID', {
                    route: 'notifications',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Notification ID is required.' });
            }
            const notification = await Notification.findByPk(notificationID);
            if (!notification || notification.userID !== req.user.userID) {
                logger.warn('Mark notification as read failed: Notification not found or unauthorized', {
                    route: 'notifications',
                    method: req.method,
                    url: req.originalUrl,
                    status: 404,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { notificationID }
                });
                return res.status(404).json({ error: 'Notification not found or unauthorized.' });
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
                metadata: { notificationID }
            });
            return res.status(200).json(notification);
        } catch (error) {
            logger.error('Failed to mark notification as read', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to mark notification as read.' });
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
                        status: { [require('sequelize').Op.in]: ['pending', 'sent'] }
                    }
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
                metadata: { userID: req.user.userID, updatedCount: updatedCount[0] }
            });
            return res.status(200).json({ message: `Marked ${updatedCount[0]} notifications as read.` });
        } catch (error) {
            logger.error('Failed to mark all notifications as read', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to mark all notifications as read.' });
        }
    }

    static async createNotification(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { event, data, roles, userIDs, type, message, email, sms } = req.body;
            if (!event || !type || !message) {
                logger.warn('Create notification failed: Missing required fields', {
                    route: 'notifications',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Event, type, and message are required.' });
            }

            const results = await NotificationService.sendNotification({
                event,
                data,
                roles: roles || [],
                userIDs: userIDs || [],
                type,
                message,
                email,
                sms
            });

            logger.info('Successfully created notification', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { event, type }
            });
            return res.status(200).json({ results, message: 'Notification sent successfully.' });
        } catch (error) {
            logger.error('Failed to create notification', {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Failed to create notification.' });
        }
    }
}

module.exports = NotificationController;