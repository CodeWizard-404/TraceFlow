const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    const NotificationPreference = sequelize.define('NotificationPreference', {
        preferenceID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `pref_${nanoid()}`,
            allowNull: false,
        },
        userID: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            references: {
                model: 'Users',
                key: 'userID',
            },
        },
        preferences: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {},
            comment: 'JSON object mapping notification events to channel preferences (e.g., { "timesheet:updated": { "email": true, "sms": true, "inApp": true } })',
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
        tableName: 'NotificationPreferences',
        timestamps: true,
    });

    return NotificationPreference;
};