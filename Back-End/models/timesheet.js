const { DataTypes } = require('sequelize');
const { nanoid } = require('nanoid');
const sequelize = require('../config/db');

const Timesheet = sequelize.define('Timesheet', {
    timesheetID: { 
        type: DataTypes.STRING,     
        primaryKey: true,
        defaultValue: () => nanoid(), 
    },
    weekNumber: { type: DataTypes.INTEGER, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    supervisorID: { type: DataTypes.STRING, allowNull: false }, 
});

module.exports = Timesheet;