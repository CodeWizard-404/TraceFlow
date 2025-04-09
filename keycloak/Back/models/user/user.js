const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('User', {
        userID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `usr_${nanoid()}`,
        },
        keycloakId: { // New field for Keycloak's sub
            type: DataTypes.STRING,
            unique: true,
            allowNull: true, // Allow null until synced with Keycloak
        },
        firstname: { type: DataTypes.STRING, allowNull: false },
        lastname: { type: DataTypes.STRING, allowNull: false },
        phone: { type: DataTypes.STRING, unique: true, allowNull: false },
        email: { type: DataTypes.STRING, unique: true, allowNull: false },
        wallet: { type: DataTypes.STRING, unique: true, allowNull: false },
        password: { type: DataTypes.STRING, allowNull: false },
        PFP: { type: DataTypes.BLOB, allowNull: true }
    });

};