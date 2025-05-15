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
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        recipients: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {},
        },
        channels: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: { websocket: true, email: false, sms: false, inApp: true },
        },
        conditions: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        messageTemplate: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
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