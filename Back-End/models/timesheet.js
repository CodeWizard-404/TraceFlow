const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user');

const Timesheet = sequelize.define('Timesheet', {
    timesheetID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    weekNumber: { type: DataTypes.INTEGER, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    supervisorID: { type: DataTypes.INTEGER, allowNull: false }, 
});

// relationship
Timesheet.belongsTo(User, { foreignKey: 'supervisorID' });

module.exports = Timesheet;