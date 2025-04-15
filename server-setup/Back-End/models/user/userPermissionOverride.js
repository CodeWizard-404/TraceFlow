const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('UserPermissionOverride', {
        overrideID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `override_${nanoid()}`,
        },
        userID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: { model: 'Users', key: 'userID' },
        },
        permissionID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: { model: 'Permissions', key: 'permissionID' },
        },
        roleID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: { model: 'Roles', key: 'roleID' },
        },
        action: {
            type: DataTypes.ENUM('grant', 'revoke'),
            allowNull: false,
        },
    });
};