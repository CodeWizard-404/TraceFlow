const { validationResult } = require('express-validator');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    SERVER_ERROR: 'Something broke. Try again later.',
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
            const result = await NotificationService.createRule(req.body, req.user.userID, {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
            });
            return res.status(201).json(result);
        } catch (error) {
            const response = NotificationController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
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
            const result = await NotificationService.updateRule(req.params.ruleID, req.body, {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
            });
            return res.status(200).json(result);
        } catch (error) {
            const response = NotificationController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
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
            const result = await NotificationService.deleteRule(req.params.ruleID, {
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
            });
            return res.status(200).json(result);
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
            const rules = await NotificationService.getRules({
                route: 'notifications/rules',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
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
            const types = await NotificationService.getNotificationTypes({
                route: 'notifications/types',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
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
            const preference = await NotificationService.updatePreferences(req.user.userID, req.body.preferences, {
                route: 'notifications/preferences',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
            });
            return res.status(200).json(preference);
        } catch (error) {
            const response = NotificationController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;
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
            const result = await NotificationService.getPreferences(req.user.userID, {
                route: 'notifications/preferences',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
            });
            return res.status(200).json(result);
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
            const notifications = await NotificationService.getNotifications(req.user.userID, {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
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
            const notification = await NotificationService.markNotificationAsRead(req.params.notificationID, req.user.userID, {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
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
            const result = await NotificationService.markAllNotificationsAsRead(req.user.userID, {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
            });
            return res.status(200).json(result);
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
            const result = await NotificationService.createNotification(req.body, {
                route: 'notifications',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
            });
            return res.status(200).json(result);
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
            const result = await NotificationService.notifyAnomaly(req.body, req.user.email, {
                route: 'notifications/anomaly',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
            });
            return res.status(200).json(result);
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
            const result = await NotificationService.notifyReport(req.body, req.user.email, {
                route: 'notifications/report',
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID
            });
            return res.status(200).json(result);
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