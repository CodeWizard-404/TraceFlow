const io = require('../utils/socket');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const { Notification, NotificationPreference, NotificationRule, User, Role } = require('../models');
const { Op } = require('sequelize');
const { getRedisClient, getRedisSubClient } = require('../config/redis');
const logger = require('../utils/logger');
const RedisUtils = require('../utils/redisUtils');

class NotificationService {
    constructor() {
        this.redis = getRedisClient();
        this.redisSub = getRedisSubClient();

        this.redisSub.subscribe('notifications', (err) => {
            if (err) {
                logger.error('Failed to subscribe to notifications', { error: err.message, service: 'redis' });
            } else {
                logger.info('Subscribed to notifications channel', { service: 'redis' });
            }
        });

        this.redisSub.on('message', (channel, message) => {
            if (channel === 'notifications') {
                try {
                    const { room, data } = JSON.parse(message);
                    io.to(room).emit('notification', data);
                    logger.info(`Published notification to room: ${room}`, { service: 'notification' });
                } catch (error) {
                    logger.error('Failed to process notification message', { error: error.message, service: 'notification' });
                }
            }
        });
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
            logger.error('WebSocket notification failed', { error: error.message, service: 'notification' });
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
            logger.error('Email notification failed', { error: error.message, service: 'notification' });
            return { success: false, method: 'Email', reason: error.message };
        }
    }

    async sendSMSNotification(to, message) {
        try {
            const result = await sendSMS(to, message, 'notification');
            return result;
        } catch (error) {
            logger.error('SMS notification failed', { error: error.message, service: 'notification' });
            return { success: false, method: 'SMS', reason: error.message };
        }
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
            const rooms = [...roles.map(r => r.toLowerCase()), ...userIDs, 'default-roles-traceflow'];
            for (const room of rooms) {
                await this.redis.publish('notifications', JSON.stringify({
                    room,
                    data: { event, ...data }
                }));
            }
            results.push({ success: true, method: 'Redis Pub/Sub' });
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

    async getUserPreferences(userID, event = null) {
        try {
            const cachedPrefs = await RedisUtils.getUserPreferences(userID);
            if (cachedPrefs) {
                return event ? cachedPrefs[event] || { email: true, sms: true, inApp: true } : cachedPrefs;
            }

            const preferences = await NotificationPreference.findOne({ where: { userID } });
            const prefs = preferences?.preferences || {};
            await RedisUtils.storeUserPreferences(userID, prefs);

            return event ? prefs[event] || { email: true, sms: true, inApp: true } : prefs;
        } catch (error) {
            logger.error('Failed to get user preferences', { error: error.message, service: 'notification' });
            return event ? { email: true, sms: true, inApp: true } : { emailEnabled: true, smsEnabled: true, inAppEnabled: true };
        }
    }

    async storeNotification({ userID, type, message, channel, event }) {
        try {
            const preferences = await this.getUserPreferences(userID, event);
            if (channel === 'in-app' && !preferences.inApp) {
                return null;
            }
            if (channel === 'email' && !preferences.email) {
                return null;
            }
            if (channel === 'sms' && !preferences.sms) {
                return null;
            }

            const notificationMessage = String(message);

            const notification = await Notification.create({
                userID,
                type,
                message: notificationMessage,
                channel,
                status: 'pending',
            });

            if (channel === 'in-app' && preferences.inApp) {
                const eventName = 'notification:created';
                const data = {
                    notificationID: notification.notificationID,
                    userID,
                    type,
                    message: notificationMessage,
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
            logger.error('Failed to store notification', { error: error.message, service: 'notification' });
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
            logger.error('Failed to update notification status', { error: error.message, service: 'notification' });
        }
    }

    async createDefaultDisabledRule({ event, data, metadata = {} }) {
        try {
            if (!event || !data) {
                return null;
            }

            const existingRule = await NotificationRule.findOne({ where: { event } });
            if (existingRule) {
                return existingRule;
            }

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

            const rule = await NotificationRule.create(defaultRule);

            return rule;
        } catch (error) {
            logger.error('Failed to create default notification rule', { error: error.message, service: 'notification' });
            return null;
        }
    }

    async triggerNotification({ event, data, metadata = {} }) {
        try {
            let rules = await NotificationRule.findAll({ where: { event, enabled: true } });

            if (!rules.length) {
                const defaultRule = await this.createDefaultDisabledRule({ event, data, metadata });
                if (defaultRule && defaultRule.enabled) {
                    rules = [defaultRule];
                } else {
                    return [];
                }
            }

            const results = [];
            for (const rule of rules) {
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
                const triggerEventPayload = { event, data, timestamp: new Date().toISOString() };
                await this.sendWebSocketNotification(event, triggerEventPayload, rule.recipients.roles || [], []);
            }

            return results;
        } catch (error) {
            logger.error('Failed to trigger notification', { error: error.message, service: 'notification' });
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
            logger.error('Failed to resolve recipients', { error: error.message, service: 'notification' });
            return [];
        }
    }

    async formatMessage(template, data) {
        return template.replace(/{(\w+)}/g, (_, key) => data[key] || '');
    }
}

module.exports = new NotificationService();