const io = require('../utils/socket');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const logger = require('../utils/logger');
const { Notification, NotificationPreference, NotificationRule, User, Role } = require('../models');
const { Op } = require('sequelize');

class NotificationService {
    static async sendWebSocketNotification(event, data, roles = [], userIDs = []) {
        try {
            const payload = { event, data, timestamp: new Date().toISOString() };
            roles.forEach((role) => {
                io.to(role.toLowerCase()).emit(event, payload);
                logger.info(`WebSocket event emitted`, {
                    event,
                    room: role.toLowerCase(),
                    data: payload,
                });
            });
            userIDs.forEach((userID) => {
                io.to(userID).emit(event, payload);
                logger.info(`WebSocket event emitted`, {
                    event,
                    userID,
                    data: payload,
                });
            });
            return { success: true, method: 'WebSocket' };
        } catch (error) {
            logger.error(`WebSocket notification error: ${error.message}`, {
                event,
                roles,
                userIDs,
                stack: error.stack,
            });
            return { success: false, method: 'WebSocket', reason: error.message };
        }
    }

    static async sendEmailNotification(to, subject, text) {
        try {
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to,
                subject,
                text,
            });
            logger.info(`Email sent`, { to, subject });
            return { success: true, method: 'Email' };
        } catch (error) {
            logger.error(`Email notification error: ${error.message}`, { to, subject, stack: error.stack });
            return { success: false, method: 'Email', reason: error.message };
        }
    }

    static async sendSMSNotification(to, message) {
        try {
            const result = await sendSMS(to, message, 'notification');
            if (result.success) {
                logger.info(`SMS sent`, { to, message });
            } else {
                logger.error(`SMS failed: ${result.reason}`, { to, message });
            }
            return result;
        } catch (error) {
            logger.error(`SMS notification error: ${error.message}`, { to, stack: error.stack });
            return { success: false, method: 'SMS', reason: error.message };
        }
    }

    static async getUserPreferences(userID) {
        try {
            const preferences = await NotificationPreference.findOne({ where: { userID } });
            return preferences || { emailEnabled: true, smsEnabled: true, inAppEnabled: true };
        } catch (error) {
            logger.error(`Error fetching user preferences: ${error.message}`, { userID, stack: error.stack });
            return { emailEnabled: true, smsEnabled: true, inAppEnabled: true };
        }
    }

    static async storeNotification({ userID, type, message, channel }) {
        try {
            const notification = await Notification.create({
                userID,
                type,
                message,
                channel,
                status: 'pending',
            });
            logger.info(`Notification stored`, { userID, notificationID: notification.notificationID, message });
            return notification;
        } catch (error) {
            logger.error(`Error storing notification: ${error.message}`, { userID, stack: error.stack });
            throw error;
        }
    }

    static async updateNotificationStatus(notificationID, status) {
        try {
            const notification = await Notification.findByPk(notificationID);
            if (notification) {
                notification.status = status;
                await notification.save();
                logger.info(`Notification status updated`, { notificationID, status });
            }
        } catch (error) {
            logger.error(`Error updating notification status: ${error.message}`, { notificationID, stack: error.stack });
        }
    }

    static async createDefaultDisabledRule({ event, data, metadata = {} }) {
        try {
            if (!event || !data) {
                logger.error(`Cannot create default rule: Missing event or data`);
                return null;
            }

            const existingRule = await NotificationRule.findOne({ where: { event } });
            if (existingRule) {
                logger.info(`Rule already exists`, { event, ruleID: existingRule.ruleID, enabled: existingRule.enabled });
                return existingRule;
            }

            const defaultRule = {
                event,
                type: data.type || 'general',
                recipients: {
                    roles: ['admin', 'Super Admin'],
                    userIDs: [],
                },
                channels: {
                    websocket: true,
                    email: false,
                    sms: false,
                    inApp: true,
                },
                conditions: data.conditions || null,
                messageTemplate: `Notification for ${event}`,
                enabled: false,
            };

            const rule = await NotificationRule.create(defaultRule);
            logger.info(`Created default disabled notification rule`, { event, ruleID: rule.ruleID });
            return rule;
        } catch (error) {
            logger.error(`Error creating default disabled rule: ${error.message}`, { event, stack: error.stack });
            return null;
        }
    }

    static async triggerNotification({ event, data, metadata = {} }) {
        try {
            let rules = await NotificationRule.findAll({ where: { event, enabled: true } });

            if (!rules.length) {
                logger.info(`No active rules found for event: ${event}`);
                const defaultRule = await this.createDefaultDisabledRule({ event, data, metadata });
                if (defaultRule) {
                    logger.info(`Created disabled rule`, { event, ruleID: defaultRule.ruleID });
                }
                return [];
            }

            const results = [];
            for (const rule of rules) {
                if (this.matchConditions(data, rule.conditions)) {
                    const recipients = await this.resolveRecipients(rule.recipients);
                    for (const user of recipients) {
                        const message = this.formatMessage(rule.messageTemplate, { ...data, ...metadata });
                        const preferences = await this.getUserPreferences(user.userID);
                        const result = await this.sendNotification({
                            event: rule.event,
                            data,
                            roles: rule.recipients.roles || [],
                            userIDs: [user.userID],
                            type: rule.type,
                            message,
                            email: rule.channels.email && preferences.emailEnabled ? user.email : null,
                            sms: rule.channels.sms && preferences.smsEnabled ? user.phone : null,
                        });
                        results.push({ userID: user.userID, ruleID: rule.ruleID, result });
                    }
                }
            }
            logger.info(`Triggered notifications`, { event, recipientCount: results.length });
            return results;
        } catch (error) {
            logger.error(`Trigger notification error: ${error.message}`, { event, stack: error.stack });
            return [{ success: false, reason: error.message }];
        }
    }

    static async resolveRecipients(recipients) {
        try {
            const users = new Set();
            if (recipients.roles?.length) {
                const roleUsers = await User.findAll({
                    include: [{
                        model: Role,
                        where: { name: { [Op.in]: recipients.roles } },
                        through: { attributes: [] },
                    }],
                });
                roleUsers.forEach(user => users.add(user));
            }
            if (recipients.userIDs?.length) {
                const specificUsers = await User.findAll({
                    where: { userID: { [Op.in]: recipients.userIDs } },
                });
                specificUsers.forEach(user => users.add(user));
            }
            return Array.from(users);
        } catch (error) {
            logger.error(`Error resolving recipients: ${error.message}`, { stack: error.stack });
            throw error;
        }
    }

    static matchConditions(data, conditions) {
        if (!conditions) return true;
        return Object.entries(conditions).every(([key, value]) => data[key] === value);
    }

    static formatMessage(template, data) {
        return template.replace(/{(\w+)}/g, (_, key) => data[key] || '');
    }

    static async sendNotification({ event, data, roles, userIDs, type, message, email, sms }) {
        const results = [];
        let notification;

        const preferences = userIDs.length ? await this.getUserPreferences(userIDs[0]) : { inAppEnabled: true };

        if (preferences.inAppEnabled && userIDs.length) {
            notification = await this.storeNotification({
                userID: userIDs[0],
                type,
                message,
                channel: 'in-app',
            });
        }

        if (event && data && (roles.length || userIDs.length) && preferences.inAppEnabled) {
            const wsResult = await this.sendWebSocketNotification(event, data, roles, userIDs);
            if (wsResult.success && notification) {
                await this.updateNotificationStatus(notification.notificationID, 'sent');
            }
            results.push(wsResult);
        }

        if (email && preferences.emailEnabled && message) {
            const subject = `TraceFlow Notification: ${type.charAt(0).toUpperCase() + type.slice(1)}`;
            const emailResult = await this.sendEmailNotification(email, subject, message);
            if (emailResult.success && userIDs.length) {
                await Notification.create({
                    userID: userIDs[0],
                    type,
                    message,
                    channel: 'email',
                    status: 'sent',
                });
            } else if (!emailResult.success && userIDs.length) {
                await Notification.create({
                    userID: userIDs[0],
                    type,
                    message,
                    channel: 'email',
                    status: 'failed',
                });
            }
            results.push(emailResult);
        }

        if (sms && preferences.smsEnabled && message) {
            const smsResult = await this.sendSMSNotification(sms, message);
            if (smsResult.success && userIDs.length) {
                await Notification.create({
                    userID: userIDs[0],
                    type,
                    message,
                    channel: 'sms',
                    status: 'sent',
                });
            } else if (!smsResult.success && userIDs.length) {
                await Notification.create({
                    userID: userIDs[0],
                    type,
                    message,
                    channel: 'sms',
                    status: 'failed',
                });
            }
            results.push(smsResult);
        }

        return results;
    }
}

module.exports = NotificationService;