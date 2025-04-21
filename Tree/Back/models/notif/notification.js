const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define('Notification', {
        notificationID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `notif_${nanoid()}`,
            allowNull: false,
        },
        userID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'userID',
            },
        },
        type: {
            type: DataTypes.ENUM('timesheet', 'receipt', 'visit', 'anomaly', 'general'),
            allowNull: false,
            defaultValue: 'general',
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('pending', 'sent', 'read', 'failed'),
            allowNull: false,
            defaultValue: 'pending',
        },
        channel: {
            type: DataTypes.ENUM('websocket', 'email', 'sms', 'in-app'),
            allowNull: false,
            defaultValue: 'in-app',
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
        tableName: 'Notifications',
        timestamps: true,
    });

    return Notification;
};