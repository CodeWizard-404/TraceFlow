const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Role', {
        roleID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `rol_${nanoid()}`,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        description: {
            type: DataTypes.STRING,
        },
    });
};