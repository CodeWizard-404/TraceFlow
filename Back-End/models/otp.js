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
        userID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'userID',
            },
        },
    }, {
        timestamps: false,
    });
};
