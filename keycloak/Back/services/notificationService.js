const io = require('../utils/socket');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const logger = require('../utils/logger');
const { Notification, NotificationPreference, NotificationRule, User, Role } = require('../models');
const { Op } = require('sequelize');

class NotificationService {
    static async sendWebSocketNotification(event, data, roles = [], userIDs = []) {
        try {
            if (!io || !io.sockets) {
                logger.error('WebSocket server not initialized', { event, timestamp: new Date().toISOString() });
                return { success: false, method: 'WebSocket', reason: 'Server not initialized' };
            }

            const payload = { event, data, timestamp: new Date().toISOString() };

            // Emit to role-based rooms
            roles.forEach((role) => {
                const room = role.toLowerCase();
                io.to(room).emit(event, payload);
            });

            // Emit to user-specific rooms
            userIDs.forEach((userID) => {
                io.to(userID).emit(event, payload);
            });

            // Emit to default room for traceability
            io.to('default-roles-traceflow').emit(event, payload);

            return { success: true, method: 'WebSocket' };
        } catch (error) {
            logger.error(`WebSocket notification error: ${error.message}`, {
                event,
                roles,
                userIDs,
                stack: error.stack,
                timestamp: new Date().toISOString(),
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
            logger.info(`Email sent`, { to, subject, timestamp: new Date().toISOString() });
            return { success: true, method: 'Email' };
        } catch (error) {
            logger.error(`Email notification error: ${error.message}`, {
                to,
                subject,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
            return { success: false, method: 'Email', reason: error.message };
        }
    }

    static async sendSMSNotification(to, message) {
        try {
            const result = await sendSMS(to, message, 'notification');
            if (result.success) {
                logger.info(`SMS sent`, { to, message, timestamp: new Date().toISOString() });
            } else {
                logger.error(`SMS failed: ${result.reason}`, { to, message, timestamp: new Date().toISOString() });
            }
            return result;
        } catch (error) {
            logger.error(`SMS notification error: ${error.message}`, {
                to,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
            return { success: false, method: 'SMS', reason: error.message };
        }
    }

    static async getUserPreferences(userID, event = null) {
        try {
            const preferences = await NotificationPreference.findOne({ where: { userID } });
            if (!preferences || !preferences.preferences) {
                return event ? { email: true, sms: true, inApp: true } : { emailEnabled: true, smsEnabled: true, inAppEnabled: true };
            }
            if (event) {
                return preferences.preferences[event] || { email: true, sms: true, inApp: true };
            }
            // For backward compatibility with existing code
            return {
                emailEnabled: true,
                smsEnabled: true,
                inAppEnabled: true,
            };
        } catch (error) {
            logger.error(`Error fetching user preferences: ${error.message}`, {
                userID,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
            return event ? { email: true, sms: true, inApp: true } : { emailEnabled: true, smsEnabled: true, inAppEnabled: true };
        }
    }

    static async storeNotification({ userID, type, message, channel, event }) {
        try {
            const preferences = await this.getUserPreferences(userID, event);
            if (channel === 'in-app' && !preferences.inApp) {
                return null; // Skip storing if inApp is disabled for this event
            }
            if (channel === 'email' && !preferences.email) {
                return null; // Skip storing if email is disabled for this event
            }
            if (channel === 'sms' && !preferences.sms) {
                return null; // Skip storing if sms is disabled for this event
            }

            const notification = await Notification.create({
                userID,
                type,
                message,
                channel,
                status: 'pending',
            });
            logger.info(`Notification stored`, {
                userID,
                notificationID: notification.notificationID,
                message,
                timestamp: new Date().toISOString(),
            });

            // Emit WebSocket event for in-app notifications
            if (channel === 'in-app' && preferences.inApp) {
                const eventName = 'notification:created';
                const data = {
                    notificationID: notification.notificationID,
                    userID,
                    type,
                    message,
                    channel,
                    status: 'pending',
                    createdAt: notification.createdAt,
                    updatedAt: notification.updatedAt,
                };
                const wsResult = await this.sendWebSocketNotification(eventName, data, [], [userID]);
                if (wsResult.success) {
                    await this.updateNotificationStatus(notification.notificationID, 'sent');
                }
            }

            return notification;
        } catch (error) {
            logger.error(`Error storing notification: ${error.message}`, {
                userID,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
            return null; // Return null instead of throwing to prevent crashes
        }
    }

    static async updateNotificationStatus(notificationID, status) {
        try {
            const notification = await Notification.findByPk(notificationID);
            if (notification) {
                notification.status = status;
                await notification.save();
                logger.info(`Notification status updated`, { notificationID, status, timestamp: new Date().toISOString() });

                // Emit WebSocket event for status updates
                const event = 'notification:updated';
                const data = {
                    notificationID,
                    status,
                    updatedAt: new Date(),
                };
                await this.sendWebSocketNotification(event, data, [], [notification.userID]);
            }
        } catch (error) {
            logger.error(`Error updating notification status: ${error.message}`, {
                notificationID,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
        }
    }

    static async createDefaultDisabledRule({ event, data, metadata = {} }) {
        try {
            if (!event || !data) {
                logger.error(`Cannot create default rule: Missing event or data`, { timestamp: new Date().toISOString() });
                return null;
            }

            const existingRule = await NotificationRule.findOne({ where: { event } });
            if (existingRule) {
                return existingRule;
            }

            // Define critical events that should have enabled default rules
            const criticalEvents = [
                'role:created',
                'role:updated',
                'role:deleted',
                'role:assigned',
                'role:revoked',
                'role:reset'
            ];

            const defaultRule = {
                event,
                type: data.type || 'general',
                recipients: {
                    roles: ['Admin', 'Super Admin'],
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
                enabled: criticalEvents.includes(event),
            };

            const rule = await NotificationRule.create(defaultRule);
            logger.info(`Created default notification rule`, {
                event,
                ruleID: rule.ruleID,
                enabled: defaultRule.enabled,
                timestamp: new Date().toISOString(),
            });
            return rule;
        } catch (error) {
            logger.error(`Error creating default rule: ${error.message}`, {
                event,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
            return null;
        }
    }

    static async triggerNotification({ event, data, metadata = {} }) {
        try {
            let rules = await NotificationRule.findAll({ where: { event, enabled: true } });

            if (!rules.length) {
                logger.info(`No active rules found for event: ${event}`, { timestamp: new Date().toISOString() });
                const defaultRule = await this.createDefaultDisabledRule({ event, data, metadata });
                if (defaultRule && defaultRule.enabled) {
                    rules = [defaultRule];
                } else {
                    return [];
                }
            }

            const results = [];
            for (const rule of rules) {
                if (this.matchConditions(data, rule.conditions)) {
                    const recipients = await this.resolveRecipients(rule.recipients);
                    for (const user of recipients) {
                        const message = this.formatMessage(rule.messageTemplate, { ...data, ...metadata });
                        const preferences = await this.getUserPreferences(user.userID, rule.event);
                        const result = await this.sendNotification({
                            event: rule.event,
                            data,
                            roles: rule.recipients.roles || [],
                            userIDs: [user.userID],
                            type: rule.type,
                            message,
                            email: rule.channels.email && preferences.email ? user.email : null,
                            sms: rule.channels.sms && preferences.sms ? user.phone : null,
                        });
                        results.push({ userID: user.userID, ruleID: rule.ruleID, result });
                    }
                    // Emit the triggering event to role-based rooms and default room
                    const triggerEventPayload = { event, data, timestamp: new Date().toISOString() };
                    await this.sendWebSocketNotification(event, triggerEventPayload, rule.recipients.roles || [], []);
                }
            }
            logger.info(`Triggered notifications`, {
                event,
                recipientCount: results.length,
                timestamp: new Date().toISOString(),
            });
            return results;
        } catch (error) {
            logger.error(`Trigger notification error: ${error.message}`, {
                event,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
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
            logger.error(`Error resolving recipients: ${error.message}`, {
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
            return [];
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

        const preferences = userIDs.length ? await this.getUserPreferences(userIDs[0], event) : { inApp: true };

        if (preferences.inApp && userIDs.length) {
            notification = await this.storeNotification({
                userID: userIDs[0],
                type,
                message,
                channel: 'in-app',
                event
            });
        }

        if (event && data && (roles.length || userIDs.length) && preferences.inApp) {
            const wsResult = await this.sendWebSocketNotification(event, data, roles, userIDs);
            results.push(wsResult);
        }

        if (email && preferences.email && message) {
            const subject = `TraceFlow Notification: ${type.charAt(0).toUpperCase() + type.slice(1)}`;
            const emailResult = await this.sendEmailNotification(email, subject, message);
            if (emailResult.success && userIDs.length) {
                await this.storeNotification({
                    userID: userIDs[0],
                    type,
                    message,
                    channel: 'email',
                    status: 'sent',
                    event
                });
            } else if (!emailResult.success && userIDs.length) {
                await this.storeNotification({
                    userID: userIDs[0],
                    type,
                    message,
                    channel: 'email',
                    status: 'failed',
                    event
                });
            }
            results.push(emailResult);
        }

        if (sms && preferences.sms && message) {
            const smsResult = await this.sendSMSNotification(sms, message);
            if (smsResult.success && userIDs.length) {
                await this.storeNotification({
                    userID: userIDs[0],
                    type,
                    message,
                    channel: 'sms',
                    status: 'sent',
                    event
                });
            } else if (!smsResult.success && userIDs.length) {
                await this.storeNotification({
                    userID: userIDs[0],
                    type,
                    message,
                    channel: 'sms',
                    status: 'failed',
                    event
                });
            }
            results.push(smsResult);
        }

        return results;
    }
}

module.exports = NotificationService;