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
        emailEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        smsEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        inAppEnabled: {
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
        tableName: 'NotificationPreferences',
        timestamps: true,
    });

    return NotificationPreference;
};