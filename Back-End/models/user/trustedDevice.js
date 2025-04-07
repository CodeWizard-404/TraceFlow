// TrustedDevice.js
const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('TrustedDevice', {
        deviceID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `dev_${nanoid()}`,
        },
        userID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: { model: 'Users', key: 'userID' },
        },
        deviceIdentifier: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
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
            allowNull: true,
        },
    }, {
        timestamps: false,
    });
};