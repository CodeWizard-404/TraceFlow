const io = require('../utils/socket');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const { Notification, NotificationPreference, NotificationRule, User, Role } = require('../models');
const { Op } = require('sequelize');
const { getRedisClient } = require('../config/redis');

class NotificationService {
    constructor() {
        this.redis = getRedisClient();
        // Optional: Set up Redis Pub/Sub subscription
        if (process.env.ENABLE_REDIS_PUBSUB === 'true') {
            this.redis.subscribe('notifications', (err) => {
                if (err) {
                    console.error('Failed to subscribe to notifications', { error: err.message });
                }
            });

            this.redis.on('message', (channel, message) => {
                if (channel === 'notifications') {
                    const { room, data } = JSON.parse(message);
                    io.to(room).emit('notification', data);
                }
            });
        }
    }

    async sendWebSocketNotification(event, data, roles = [], userIDs = []) {
        try {
            if (!io || !io.sockets) {
                return { success: false, method: 'WebSocket', reason: 'Server not initialized' };
            }

            const payload = { event, data, timestamp: new Date().toISOString() };

            roles.forEach((role) => {
                const room = role.toLowerCase();
                io.to(room).emit(event, payload);
            });

            userIDs.forEach((userID) => {
                io.to(userID).emit(event, payload);
            });

            io.to('default-roles-traceflow').emit(event, payload);

            return { success: true, method: 'WebSocket' };
        } catch (error) {
            return { success: false, method: 'WebSocket', reason: error.message };
        }
    }

    async sendEmailNotification(to, subject, text) {
        try {
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to,
                subject,
                text,
            });
            return { success: true, method: 'Email' };
        } catch (error) {
            return { success: false, method: 'Email', reason: error.message };
        }
    }

    async sendSMSNotification(to, message) {
        try {
            const result = await sendSMS(to, message, 'notification');
            return result;
        } catch (error) {
            return { success: false, method: 'SMS', reason: error.message };
        }
    }

    async getUserPreferences(userID, event = null) {
        try {
            const preferences = await NotificationPreference.findOne({ where: { userID } });
            if (!preferences || !preferences.preferences) {
                return event ? { email: true, sms: true, inApp: true } : { emailEnabled: true, smsEnabled: true, inAppEnabled: true };
            }
            if (event) {
                return preferences.preferences[event] || { email: true, sms: true, inApp: true };
            }
            return {
                emailEnabled: true,
                smsEnabled: true,
                inAppEnabled: true,
            };
        } catch (error) {
            return event ? { email: true, sms: true, inApp: true } : { emailEnabled: true, smsEnabled: true, inAppEnabled: true };
        }
    }

    async storeNotification({ userID, type, message, channel, event }) {
        try {
            const preferences = await this.getUserPreferences(userID, event);
            if (channel === 'in-app' && !preferences.inApp) return null;
            if (channel === 'email' && !preferences.email) return null;
            if (channel === 'sms' && !preferences.sms) return null;

            const notification = await Notification.create({
                userID,
                type,
                message,
                channel,
                status: 'pending',
            });

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
            return null;
        }
    }

    async updateNotificationStatus(notificationID, status) {
        try {
            const notification = await Notification.findByPk(notificationID);
            if (notification) {
                notification.status = status;
                await notification.save();

                const event = 'notification:updated';
                const data = {
                    notificationID,
                    status,
                    updatedAt: new Date(),
                };
                await this.sendWebSocketNotification(event, data, [], [notification.userID]);
            }
        } catch (error) {
            console.error('Error updating notification status:', error.message);
        }
    }

    async createDefaultDisabledRule({ event, data, metadata = {} }) {
        try {
            if (!event || !data) return null;

            const existingRule = await NotificationRule.findOne({ where: { event } });
            if (existingRule) return existingRule;

            const notificationType = event.split(':')[0];
            const defaultRule = {
                event,
                type: notificationType,
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
                enabled: true,
            };

            return await NotificationRule.create(defaultRule);
        } catch (error) {
            return null;
        }
    }

    async publishNotification(room, data) {
        if (process.env.ENABLE_REDIS_PUBSUB === 'true') {
            await this.redis.publish('notifications', JSON.stringify({ room, data }));
        }
    }

    async triggerNotification({ event, data, metadata = {} }) {
        try {
            let rules = await NotificationRule.findAll({ where: { event, enabled: true } });

            if (!rules.length) {
                const defaultRule = await this.createDefaultDisabledRule({ event, data, metadata });
                if (defaultRule && defaultRule.enabled) rules = [defaultRule];
                else return [];
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

                        // Optionally publish to Redis Pub/Sub
                        if (process.env.ENABLE_REDIS_PUBSUB === 'true') {
                            await this.publishNotification(user.userID, { event: rule.event, data });
                        }
                    }
                    const triggerEventPayload = { event, data, timestamp: new Date().toISOString() };
                    await this.sendWebSocketNotification(event, triggerEventPayload, rule.recipients.roles || [], []);
                }
            }

            return results;
        } catch (error) {
            return [{ success: false, reason: error.message }];
        }
    }

    async resolveRecipients(recipients) {
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
            return [];
        }
    }

    matchConditions(data, conditions) {
        if (!conditions) return true;
        return Object.entries(conditions).every(([key, value]) => data[key] === value);
    }

    formatMessage(template, data) {
        return template.replace(/{(\w+)}/g, (_, key) => data[key] || '');
    }

    async sendNotification({ event, data, roles, userIDs, type, message, email, sms }) {
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

module.exports = new NotificationService();