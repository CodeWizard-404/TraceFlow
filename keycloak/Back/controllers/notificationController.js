const { NotificationRule, NotificationPreference, Notification } = require('../models');
const logger = require('../utils/logger');

class NotificationController {
    // Create a new notification rule (admin only)
    static async createRule(req, res) {
        try {
            const { event, type, recipients, channels, conditions, messageTemplate, enabled } = req.body;
            if (!event || !type || !recipients || !channels || !messageTemplate) {
                logger.warn(`Create notification rule failed: Missing fields, user: ${req.user.userID}, IP: ${req.ip}`);
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
            logger.info(`Notification rule created: ${rule.ruleID} by user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(rule);
        } catch (error) {
            logger.error(`Create notification rule error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to create notification rule.' });
        }
    }

    // Update a notification rule (admin only)
    static async updateRule(req, res) {
        try {
            const { ruleID } = req.params;
            const { event, type, recipients, channels, conditions, messageTemplate, enabled } = req.body;
            if (!ruleID) {
                logger.warn(`Update notification rule failed: Missing ruleID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Rule ID is required.' });
            }
            const rule = await NotificationRule.findByPk(ruleID);
            if (!rule) {
                logger.warn(`Update notification rule failed: Rule not found, ruleID: ${ruleID}, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(404).json({ error: 'Notification rule not found.' });
            }
            await rule.update({
                event,
                type,
                recipients,
                channels,
                conditions,
                messageTemplate,
                enabled,
            });
            logger.info(`Notification rule updated: ${ruleID} by user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(rule);
        } catch (error) {
            logger.error(`Update notification rule error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to update notification rule.' });
        }
    }

    // Delete a notification rule (admin only)
    static async deleteRule(req, res) {
        try {
            const { ruleID } = req.params;
            if (!ruleID) {
                logger.warn(`Delete notification rule failed: Missing ruleID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Rule ID is required.' });
            }
            const rule = await NotificationRule.findByPk(ruleID);
            if (!rule) {
                logger.warn(`Delete notification rule failed: Rule not found, ruleID: ${ruleID}, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(404).json({ error: 'Notification rule not found.' });
            }
            await rule.destroy();
            logger.info(`Notification rule deleted: ${ruleID} by user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json({ message: 'Notification rule deleted successfully.' });
        } catch (error) {
            logger.error(`Delete notification rule error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to delete notification rule.' });
        }
    }

    // Get all notification rules (admin only)
    static async getRules(req, res) {
        try {
            const rules = await NotificationRule.findAll();
            logger.info(`Fetched notification rules by user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(rules);
        } catch (error) {
            logger.error(`Fetch notification rules error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to fetch notification rules.' });
        }
    }

    // Update user notification preferences
    static async updatePreferences(req, res) {
        try {
            const { emailEnabled, smsEnabled, inAppEnabled } = req.body;
            if (emailEnabled === undefined || smsEnabled === undefined || inAppEnabled === undefined) {
                logger.warn(`Update notification preferences failed: Missing fields, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'All preference fields must be provided.' });
            }
            let preference = await NotificationPreference.findOne({ where: { userID: req.user.userID } });
            if (!preference) {
                preference = await NotificationPreference.create({
                    userID: req.user.userID,
                    emailEnabled,
                    smsEnabled,
                    inAppEnabled,
                });
            } else {
                await preference.update({ emailEnabled, smsEnabled, inAppEnabled });
            }
            logger.info(`Notification preferences updated for user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(preference);
        } catch (error) {
            logger.error(`Update notification preferences error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to update notification preferences.' });
        }
    }

    // Get user notification preferences
    static async getPreferences(req, res) {
        try {
            const preference = await NotificationPreference.findOne({ where: { userID: req.user.userID } });
            logger.info(`Fetched notification preferences for user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(preference || { emailEnabled: true, smsEnabled: true, inAppEnabled: true });
        } catch (error) {
            logger.error(`Fetch notification preferences error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to fetch notification preferences.' });
        }
    }

    // Get user notifications
    static async getNotifications(req, res) {
        try {
            const notifications = await Notification.findAll({
                where: { userID: req.user.userID },
                order: [['createdAt', 'DESC']],
            });
            logger.info(`Fetched notifications for user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(notifications);
        } catch (error) {
            logger.error(`Fetch notifications error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to fetch notifications.' });
        }
    }

    // Mark notification as read
    static async markNotificationAsRead(req, res) {
        try {
            const { notificationID } = req.params;
            if (!notificationID) {
                logger.warn(`Mark notification as read failed: Missing notificationID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Notification ID is required.' });
            }
            const notification = await Notification.findByPk(notificationID);
            if (!notification || notification.userID !== req.user.userID) {
                logger.warn(`Mark notification as read failed: Notification not found or unauthorized, notificationID: ${notificationID}, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(404).json({ error: 'Notification not found or unauthorized.' });
            }
            await notification.update({ status: 'read' });
            logger.info(`Notification marked as read: ${notificationID} by user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(notification);
        } catch (error) {
            logger.error(`Mark notification as read error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to mark notification as read.' });
        }
    }
}

module.exports = NotificationController;