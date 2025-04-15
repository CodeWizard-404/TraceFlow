const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('TrustedDevice', {
        deviceID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `dev_${uuidv4()}`,
        },
        userID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: { model: 'Users', key: 'userID' },
        },
        deviceToken: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        userAgent: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active',
        },
        lastUsed: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['userID', 'deviceToken'],
            },
        ],
    });
};