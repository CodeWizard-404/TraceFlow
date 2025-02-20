const { DataTypes } = require('sequelize');
const { nanoid } = require('nanoid');
const sequelize = require('../config/db');

const Visit = sequelize.define('Visit', {
    visitID: { 
        type: DataTypes.STRING,     
        primaryKey: true,
        defaultValue: () => nanoid(), 
    },
    date: { type: DataTypes.DATE, allowNull: false },
    time: { type: DataTypes.TIME, allowNull: false },
    duration: { type: DataTypes.INTEGER, allowNull: false }, 
    location: { type: DataTypes.STRING, allowNull: false },
    reason: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false }, 
    checklist: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false }, 
    status: { type: DataTypes.STRING, defaultValue: 'pending', allowNull: false },
    photos: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [], allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true },
    agentID: { type: DataTypes.STRING, allowNull: false }, 
    supervisorID: { type: DataTypes.STRING, allowNull: false }, 
    timesheetID: { type: DataTypes.STRING, allowNull: false }, 
});

module.exports = Visit;