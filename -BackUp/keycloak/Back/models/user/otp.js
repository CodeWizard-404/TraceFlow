// models/user/otp.js
const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('OTP', {
        otpID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `otp_${nanoid()}`,
        },
        code: { type: DataTypes.STRING, allowNull: false },
        expiresAt: { type: DataTypes.DATE, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        used: { type: DataTypes.BOOLEAN, defaultValue: false },
        userID: {
            type: DataTypes.STRING,
            allowNull: true,
            references: { model: 'Users', key: 'userID' },
        },
        agentID: {
            type: DataTypes.STRING,
            allowNull: true,
            references: { model: 'Agents', key: 'agentID' }
        },
    }, {
        timestamps: false,
        validate: {
            atLeastOneID() {
                if (!this.userID && !this.agentID) {
                    throw new Error('Either userID or agentID must be provided');
                }
            }
        }
    });
};