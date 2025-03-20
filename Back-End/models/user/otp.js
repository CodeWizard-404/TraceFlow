const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('OTP', {
        otpID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `otp_${nanoid()}`,
        },
        code: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        userID: { // Foreign key to User
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'userID',
            },
        },
        agentID: { 
            type: DataTypes.STRING, 
            allowNull: true, 
            references: { 
                model: 'Agents', 
                key: 'agentID' 
            } 
        },
    }, {
        timestamps: false, 
    });
};