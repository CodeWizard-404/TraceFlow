const io = require('../utils/socket');
const { sendSMS } = require('../config/sms');
const { sendEmail } = require('../config/smtp');
const { Notification, NotificationPreference, NotificationRule, User, Role } = require('../models');
const { Op } = require('sequelize');
const { getRedisClient, getRedisSubClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');

class NotificationService {
    constructor() {
        this.redis = getRedisClient();
        this.redisSub = getRedisSubClient();

        this.redisSub.subscribe('notifications', (err) => {
            if (err) {
                console.error('Failed to subscribe to notifications:', err.message);
            } else {
                console.log('Subscribed to notifications channel');
            }
        });

        this.redisSub.on('message', (channel, message) => {
            if (channel === 'notifications') {
                try {
                    const { room, data } = JSON.parse(message);
                    io.to(room).emit('notification', data);
                } catch (error) {
                    console.error('Failed to process notification message:', error.message);
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
            const rooms = [...roles.map(r => r.toLowerCase()), ...userIDs, 'default-roles-traceflow'].filter(Boolean);
            if (rooms.length === 0) {
                return { success: true, method: 'WebSocket', reason: 'No rooms to notify' };
            }
            rooms.forEach((room) => {
                io.to(room).emit(event, payload);
            });
            return { success: true, method: 'WebSocket' };
        } catch (error) {
            console.error('WebSocket notification failed:', error.message);
            return { success: false, method: 'WebSocket', reason: error.message };
        }
    }

    async sendEmailNotification(to, subject, message, data = {}, metadata = {}) {
        try {
            console.log('sendEmailNotification: message parameter:', message);
            const resolvedMessage = await Promise.resolve(message);
            let detailedMessage = `Event: ${resolvedMessage}\n`;
            if (data && Object.keys(data).length) {
                detailedMessage += `Details:\n${Object.entries(data)
                    .map(([key, value]) => `- ${key}: ${value}`)
                    .join('\n')}\n`;
            }
            if (metadata.triggeredBy) {
                detailedMessage += `Triggered by: ${metadata.triggeredBy}\n`;
            }
            detailedMessage += `Timestamp: ${new Date().toLocaleString()}\n`;

            await sendEmail({
                to,
                subject,
                templateName: 'default',
                replacements: {
                    firstname: 'User',
                    content: detailedMessage.replace(/\n/g, '<br>'),
                    event: resolvedMessage,
                    timestamp: new Date().toLocaleString(),
                    platformUrl: process.env.PLATFORM_URL || 'https://traceflow.example.com',
                },
                textFallback: detailedMessage,
            });
            return { success: true, method: 'Email' };
        } catch (error) {
            console.error('Email notification failed:', error.message);
            return { success: false, method: 'Email', reason: error.message };
        }
    }

    async sendSMSNotification(to, message, data = {}, metadata = {}) {
        try {
            const resolvedMessage = await Promise.resolve(message);
            let smsMessage = `${resolvedMessage}`;
            if (data && Object.keys(data).length) {
                const keyDetail = Object.entries(data)[0];
                smsMessage += ` (${keyDetail[0]}: ${keyDetail[1]})`;
            }
            smsMessage += `. Check traceflow.app`;
            const result = await sendSMS(to, smsMessage, 'notification');
            return result;
        } catch (error) {
            console.error('SMS notification failed:', error.message);
            return { success: false, method: 'SMS', reason: error.message };
        }
    }

    async sendNotification({ event, data, roles, userIDs, type, message, email, sms, metadata = {}, rule }) {
        const results = [];
        let notification;
        const resolvedMessage = await Promise.resolve(message);

        // Check if the rule is disabled
        if (!rule.enabled) {
            return [{ success: false, method: 'All', reason: 'Rule is disabled' }];
        }

        // For high-priority rules, ignore user preferences and use rule channels
        const isHighPriority = rule.priority === 'high';
        const preferences = isHighPriority
            ? { inApp: rule.channels.inApp, email: rule.channels.email, sms: rule.channels.sms }
            : (userIDs.length ? (await this.getUserPreferences(userIDs[0], event, rule)).preferences : { inApp: true });

        if (preferences.inApp && userIDs.length) {
            notification = await this.storeNotification({
                userID: userIDs[0],
                type,
                message: resolvedMessage,
                channel: 'in-app',
                event,
                rule,
            });
            if (notification) {
                results.push({ success: true, method: 'In-App' });
            }
        }

        if (email && preferences.email && resolvedMessage) {
            const subject = `TraceFlow Notification: ${type.charAt(0).toUpperCase() + type.slice(1)}`;
            const emailResult = await this.sendEmailNotification(email, subject, resolvedMessage, data, metadata);
            if (emailResult.success && userIDs.length) {
                await this.storeNotification({
                    userID: userIDs[0],
                    type,
                    message: resolvedMessage,
                    channel: 'email',
                    status: 'sent',
                    event,
                    rule,
                });
            } else if (!emailResult.success && userIDs.length) {
                await this.storeNotification({
                    userID: userIDs[0],
                    type,
                    message: resolvedMessage,
                    channel: 'email',
                    status: 'failed',
                    event,
                    rule,
                });
            }
            results.push(emailResult);
        }

        if (sms && preferences.sms && resolvedMessage) {
            const smsResult = await this.sendSMSNotification(sms, resolvedMessage, data, metadata);
            if (smsResult.success && userIDs.length) {
                await this.storeNotification({
                    userID: userIDs[0],
                    type,
                    message: resolvedMessage,
                    channel: 'sms',
                    status: 'sent',
                    event,
                    rule,
                });
            } else if (!smsResult.success && userIDs.length) {
                await this.storeNotification({
                    userID: userIDs[0],
                    type,
                    message: resolvedMessage,
                    channel: 'sms',
                    status: 'failed',
                    event,
                    rule,
                });
            }
            results.push(smsResult);
        }

        return results;
    }

    async getUserPreferences(userID, event = null, rule = null) {
        try {
            const cachedPrefs = await RedisUtils.getUserPreferences(userID);
            if (cachedPrefs) {
                const prefs = event ? cachedPrefs[event] || { email: true, sms: true, inApp: true } : cachedPrefs;
                return {
                    preferences: prefs,
                    isCustomizable: !rule || rule.priority !== 'high',
                };
            }
            const preferences = await NotificationPreference.findOne({ where: { userID } });
            let prefs = preferences?.preferences || {};
            if (rule && rule.priority === 'high' && prefs[event]) {
                // Remove event preferences if rule is high-priority
                delete prefs[event];
                await NotificationPreference.update(
                    { preferences: prefs },
                    { where: { userID } }
                );
                await RedisUtils.invalidateUserPreferences(userID);
            }
            await RedisUtils.storeUserPreferences(userID, prefs);
            const eventPrefs = event ? prefs[event] || { email: true, sms: true, inApp: true } : prefs;
            return {
                preferences: eventPrefs,
                isCustomizable: !rule || rule.priority !== 'high',
            };
        } catch (error) {
            console.error('Failed to get user preferences:', error.message);
            return {
                preferences: event ? { email: true, sms: true, inApp: true } : { emailEnabled: true, smsEnabled: true, inAppEnabled: true },
                isCustomizable: !rule || rule.priority !== 'high',
            };
        }
    }

    async storeNotification({ userID, type, message, channel, event, rule }) {
        try {
            // Do not store notifications for disabled rules
            if (!rule || !rule.enabled) {
                return null;
            }

            // For high-priority rules, use rule channels; otherwise, check user preferences
            const { preferences } = await this.getUserPreferences(userID, event, rule);
            if (channel === 'in-app' && !preferences.inApp) return null;
            if (channel === 'email' && !preferences.email) return null;
            if (channel === 'sms' && !preferences.sms) return null;

            const notificationMessage = await Promise.resolve(message).then(String);
            if (!notificationMessage) {
                console.error(`Invalid notification message for event: ${event}`);
                return null;
            }

            const notification = await Notification.create({
                userID,
                type,
                message: notificationMessage,
                channel,
                status: 'pending',
            });

            if (channel === 'in-app' && preferences.inApp) {
                await this.updateNotificationStatus(notification.notificationID, 'sent');
                await this.sendWebSocketNotification('notification:created', { data: notification }, [], [userID]);
            }

            return notification;
        } catch (error) {
            console.error('Failed to store notification:', error.message);
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
            console.error('Failed to update notification status:', error.message);
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
                    roles: [process.env.ROLE_ADMIN, process.env.ROLE_SUPER_ADMIN],
                    userIDs: [],
                },
                channels: {
                    email: event.includes('ai:') ? true : false,
                    sms: event.includes('ai:anomaly_detected') ? true : false,
                    inApp: true,
                },
                conditions: data.conditions || null,
                messageTemplate: event === 'ai:anomaly_detected'
                    ? 'AI detected {anomalyCount} anomalies in {dataType} data.'
                    : event === 'ai:report_generated'
                        ? 'AI generated a {format} report with filters: {filters}.'
                        : '{event}',
                enabled: true,
                priority: 'normal',
            };
            const rule = await NotificationRule.create(defaultRule);
            return rule;
        } catch (error) {
            console.error('Failed to create default notification rule:', error.message);
            return null;
        }
    }

    async handlePriorityChange(rule) {
        try {
            // Check if rule is high-priority
            if (rule.priority !== 'high') return;

            // Find all users who might have preferences for this event
            const preferences = await NotificationPreference.findAll({
                where: {
                    preferences: {
                        [Op.contains]: { [rule.event]: {} }
                    }
                }
            });

            for (const pref of preferences) {
                const userPrefs = pref.preferences || {};
                if (userPrefs[rule.event]) {
                    delete userPrefs[rule.event];
                    await NotificationPreference.update(
                        { preferences: userPrefs },
                        { where: { userID: pref.userID } }
                    );
                    await RedisUtils.invalidateUserPreferences(pref.userID);
                }
            }
        } catch (error) {
            console.error('Failed to handle priority change:', error.message);
        }
    }

    async triggerNotification({ event, data, metadata = {} }) {
        try {
            // Fetch all users and roles for WebSocket notifications
            const allUsers = await User.findAll();
            const allRoles = await Role.findAll();
            const userIDs = allUsers.map(user => user.userID);
            const roleNames = allRoles.map(role => role.name);

            // Send WebSocket notification to all users and roles unconditionally
            const triggerEventPayload = { event, data, timestamp: new Date().toISOString() };
            await this.sendWebSocketNotification(event, triggerEventPayload, roleNames, userIDs);

            // Fetch all rules (enabled or disabled) to check for priority changes
            const allRules = await NotificationRule.findAll({ where: { event } });
            for (const rule of allRules) {
                await this.handlePriorityChange(rule);
            }

            // Fetch only enabled rules for in-app, email, and SMS notifications
            const rules = await NotificationRule.findAll({ where: { event, enabled: true } });
            if (!rules.length) {
                const defaultRule = await this.createDefaultDisabledRule({ event, data, metadata });
                if (defaultRule && defaultRule.enabled) {
                    await this.handlePriorityChange(defaultRule);
                    rules.push(defaultRule);
                } else {
                    return [{ success: true, method: 'WebSocket', reason: 'No enabled rules, WebSocket sent' }];
                }
            }

            const results = [];
            for (const rule of rules) {
                const recipients = await this.resolveRecipients(rule.recipients);
                for (const user of recipients) {
                    const messageData = { event, ...data, ...metadata };
                    const message = await this.formatMessage(rule.messageTemplate, messageData);
                    if (!message) {
                        throw new Error(`Invalid notification message for event: ${event}`);
                    }
                    const result = await this.sendNotification({
                        event: rule.event,
                        data,
                        roles: rule.recipients.roles || [],
                        userIDs: [user.userID],
                        type: rule.type,
                        message,
                        email: rule.channels.email ? user.email : null,
                        sms: rule.channels.sms ? user.phone : null,
                        metadata,
                        rule,
                    });
                    results.push({ userID: user.userID, ruleID: rule.ruleID, result });
                }
            }

            return results;
        } catch (error) {
            console.error('Failed to trigger notification:', error.message);
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
            console.error('Failed to resolve recipients:', error.message);
            return [];
        }
    }

    async formatMessage(template, data) {
        const resolvedData = {};
        for (const [key, value] of Object.entries(data)) {
            resolvedData[key] = await Promise.resolve(value);
        }
        return template.replace(/{(\w+)}/g, (_, key) => resolvedData[key] || '');
    }
}

module.exports = new NotificationService();