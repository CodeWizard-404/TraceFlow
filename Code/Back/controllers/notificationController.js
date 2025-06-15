const { validationResult } = require('express-validator');
const NotificationService = require('../services/notificationService');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');
const { User, NotificationRule } = require('../models');


const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    SERVER_ERROR: 'Something broke. Try again later.',
};

/**
 * Controller for managing notification-related operations.
 */
class NotificationController {
    static async createRule(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'notification',
                    defaultRoute: 'notifications'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const result = await NotificationService.createRule(req.body, req.user.userID, { transaction });
            const user = await User.findByPk(req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('notifications');
            await cacheInstance.invalidate(`notification:rules:${req.user.userID}`);
            await redis.set('notifications:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'notifications');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'notification_rule:created',
                data: { rule: result },
                metadata: { createdBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user?.userID || 'unknown',
                type: 'notification',
                customMessage: `Notification rule ${result.event} created by user ${user.firstname} ${user.lastname} `,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 201,
                message: `Created notification rule by user ${req.user.userID}`,
                level: 'info',
                metadata: { rule: result, requestID },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            await transaction.commit();
            return res.status(201).json(result);
        } catch (error) {
            await transaction.rollback();
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to create notification rule: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(status).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async updateRule(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'notification',
                    defaultRoute: 'notifications'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const { ruleID } = req.params;
            const result = await NotificationService.updateRule(ruleID, req.body, { transaction });
            const user = await User.findByPk(req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('notifications');
            await cacheInstance.invalidate(`notification:rules:${req.user.userID}`);
            await redis.set('notifications:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'notifications');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'notification-rule:updated',
                data: { ruleID, updates: req.body },
                metadata: { updatedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user?.userID || 'unknown',
                type: 'notification',
                customMessage: `Notification rule ${result.event} updated by user ${user.firstname} ${user.lastname} `,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Updated notification rule ${ruleID} for user ${req.user.userID}`,
                level: 'info',
                metadata: { ruleID, updates: req.body, requestID },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to update notification rule: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(status).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async deleteRule(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'notification',
                    defaultRoute: 'notifications'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const { ruleID } = req.params;
            const rule = await NotificationRule.findByPk(ruleID);
            const user = await User.findByPk(req.user.userID);
            const result = await NotificationService.deleteRule(ruleID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('notifications');
            await cacheInstance.invalidate(`notification:rules:${req.user.userID}`);
            await redis.set('notifications:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'notifications');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'notification_rule:deleted',
                data: { ruleID },
                metadata: { deletedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user?.userID || 'unknown',
                type: 'notification',
                customMessage: `Notification rule ${rule.event} deleted by user ${user.firstname} ${user.lastname} `,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Deleted notification rule ${ruleID} for user ${req.user.userID}`,
                level: 'info',
                metadata: { ruleID, requestID },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to delete notification rule: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(status).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async getRules(req, res) {
        try {
            const cacheInstance = await cache();
            const rules = await cacheInstance.getOrSet(`notification:rules:${req.user.userID}`, async () => {
                return await NotificationService.getRules();
            }, 'api');

            logRequest({
                req,
                res: rules,
                status: 200,
                message: `Retrieved ${rules.length} notification rules for user ${req.user.userID}`,
                level: 'info',
                metadata: { ruleCount: rules.length },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            return res.status(200).json(rules);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch notification rules: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(500).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async getNotificationTypes(req, res) {
        try {
            const cacheInstance = await cache();
            const types = await cacheInstance.getOrSet('notification:types', async () => {
                return await NotificationService.getNotificationTypes();
            }, 'api');

            logRequest({
                req,
                res: { types },
                status: 200,
                message: `Retrieved ${types.length} notification types`,
                level: 'info',
                metadata: { typeCount: types.length },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            return res.status(200).json({ types });
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch notification types: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(500).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async updatePreferences(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'notification',
                    defaultRoute: 'notifications'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const preference = await NotificationService.updatePreferences(req.user.userID, req.body.preferences, { transaction });
            const user = await User.findByPk(req.user.userID);

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('notifications');
            await cacheInstance.invalidate(`notification:preferences:${req.user.userID}`);
            await redis.set('notifications:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'notifications');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'notification_prefrences:updated',
                data: { userID: req.user.userID, preferences: req.body.preferences },
                metadata: { updatedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user?.userID || 'unknown',
                type: 'notification',
                customMessage: `Notification preferences updated for user ${user.firstname} ${user.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: preference,
                status: 200,
                message: `Updated notification preferences for user ${req.user.userID}`,
                level: 'info',
                metadata: { preferences: req.body.preferences, requestID },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            await transaction.commit();
            return res.status(200).json(preference);
        } catch (error) {
            await transaction.rollback();
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to update notification preferences: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(status).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async getPreferences(req, res) {
        try {
            const cacheInstance = await cache();
            const result = await cacheInstance.getOrSet(`notification:preferences:${req.user.userID}`, async () => {
                return await NotificationService.getPreferences(req.user.userID);
            }, 'api');

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Retrieved notification preferences for user ${req.user.userID}`,
                level: 'info',
                metadata: { userID: req.user.userID },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch notification preferences: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(500).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async getNotifications(req, res) {
        try {
            const cacheInstance = await cache();
            const notifications = await cacheInstance.getOrSet(`notification:notifications:${req.user.userID}`, async () => {
                return await NotificationService.getNotifications(req.user.userID);
            }, 'api');

            logRequest({
                req,
                res: notifications,
                status: 200,
                message: `Retrieved ${notifications.length} notifications for user ${req.user.userID}`,
                level: 'info',
                metadata: { notificationCount: notifications.length },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            return res.status(200).json(notifications);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch notifications: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(500).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async markNotificationAsRead(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'notification',
                    defaultRoute: 'notifications'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const { notificationID } = req.params;
            const notification = await NotificationService.markNotificationAsRead(notificationID, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('notifications');
            await cacheInstance.invalidate(`notification:notifications:${req.user.userID}`);
            await redis.set('notifications:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'notifications');

            const requestID = uuidv4();

            logRequest({
                req,
                res: notification,
                status: 200,
                message: `Marked notification ${notificationID} as read for user ${req.user.userID}`,
                level: 'info',
                metadata: { notificationID, requestID },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            await transaction.commit();
            return res.status(200).json(notification);
        } catch (error) {
            await transaction.rollback();
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to mark notification as read: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(status).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async markAllNotificationsAsRead(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const result = await NotificationService.markAllNotificationsAsRead(req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('notifications');
            await cacheInstance.invalidate(`notification:notifications:${req.user.userID}`);
            await redis.set('notifications:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'notifications');

            const requestID = uuidv4();

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Marked all notifications as read for user ${req.user.userID}`,
                level: 'info',
                metadata: { userID: req.user.userID, requestID },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to mark all notifications as read: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(500).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async createNotification(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'notification',
                    defaultRoute: 'notifications'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const result = await NotificationService.createNotification(req.body, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('notifications');
            await redis.set('notifications:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'notifications');

            const requestID = uuidv4();

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Created notification for user ${req.user.userID}`,
                level: 'info',
                metadata: { notification: req.body, requestID },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to create notification: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(status).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async notifyAnomaly(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'notification',
                    defaultRoute: 'notifications'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const result = await NotificationService.notifyAnomaly(req.body, req.user.email, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('notifications');
            await redis.set('notifications:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'notifications');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'notification:anomaly_triggered',
                data: { anomaly: req.body },
                metadata: { triggeredBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user?.userID || 'unknown',
                type: 'notification',
                customMessage: `Anomaly notification triggered `,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Triggered anomaly notification for user ${req.user.userID}`,
                level: 'info',
                metadata: { anomaly: req.body, requestID },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to trigger anomaly notification: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(status).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }

    static async notifyReport(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: ERROR_MESSAGES.MISSING_FIELDS,
                    level: 'info',
                    service: 'notification',
                    defaultRoute: 'notifications'
                });
                return res.status(400).json({ error: ERROR_MESSAGES.MISSING_FIELDS });
            }

            const result = await NotificationService.notifyReport(req.body, req.user.email, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('notifications');
            await redis.set('notifications:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'notifications');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'notification:report_triggered',
                data: { report: req.body },
                metadata: { triggeredBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user?.userID || 'unknown',
                type: 'notification',
                customMessage: `Report notification triggered `,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Triggered report notification for user ${req.user.userID}`,
                level: 'info',
                metadata: { report: req.body, requestID },
                service: 'notification',
                defaultRoute: 'notifications'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
            logRequest({
                req,
                error,
                status,
                message: `Failed to trigger report notification: ${error.message}`,
                level: 'error',
                service: 'notification',
                defaultRoute: 'notifications'
            });
            return res.status(status).json({ error: error.message || ERROR_MESSAGES.SERVER_ERROR });
        }
    }
}

module.exports = NotificationController;