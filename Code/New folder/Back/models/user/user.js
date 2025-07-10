// models/user.js
const { nanoid } = require('nanoid');
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('User', {
        userID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `usr_${nanoid()}`,
        },
        keycloakId: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true,
        },
        firstname: { type: DataTypes.STRING, allowNull: false },
        lastname: { type: DataTypes.STRING, allowNull: false },
        phone: { type: DataTypes.STRING, unique: true, allowNull: false },
        email: { type: DataTypes.STRING, unique: true, allowNull: false },
        password: { type: DataTypes.STRING, allowNull: false },
        isOnline: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
        hasGoogleAuth: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
        hasCalendarAccess: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
        PFP: { type: DataTypes.BLOB, allowNull: true },
        tempResetToken: { type: DataTypes.STRING, allowNull: true },
        regionalManagerID: {
            type: DataTypes.STRING,
            allowNull: true,
            references: { model: 'Users', key: 'userID' },
        },
        directorID: {
            type: DataTypes.STRING,
            allowNull: true,
            references: { model: 'Users', key: 'userID' },
        },
    });
};