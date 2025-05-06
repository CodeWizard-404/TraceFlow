// models/log.js
const { nanoid } = require('nanoid');
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Log', {
        logID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `log_${nanoid()}`,
        },
        level: { type: DataTypes.STRING, allowNull: false },
        message: { type: DataTypes.TEXT, allowNull: false },
        ip: { type: DataTypes.STRING, allowNull: true },
        timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    });
};