const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Permission', {
        permissionID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `perm_${nanoid()}`,
        },
        permission: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    });
};