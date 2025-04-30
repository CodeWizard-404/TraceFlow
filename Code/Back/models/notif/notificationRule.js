const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    const NotificationRule = sequelize.define('NotificationRule', {
        ruleID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `rule_${nanoid()}`,
            allowNull: false,
        },
        event: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Event triggering the notification (e.g., timesheet:updated)',
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Notification type (e.g., timesheet, receipt, visit)',
        },
        recipients: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {},
            comment: 'JSON object defining recipients (e.g., { roles: ["manager"], userIDs: [] })',
        },
        channels: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: { websocket: true, email: false, sms: false, inApp: true },
            comment: 'JSON object specifying delivery channels (e.g., { websocket: true, email: false })',
        },
        conditions: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'JSON object defining conditions (e.g., { status: "validated" })',
        },
        messageTemplate: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: 'Template for notification message (e.g., "Timesheet {id} updated to {status}")',
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: 'Whether the rule is active',
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'NotificationRules',
        timestamps: true,
    });

    return NotificationRule;
};