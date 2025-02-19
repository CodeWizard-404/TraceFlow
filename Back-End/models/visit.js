const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user');

const Visit = sequelize.define('Visit', {
    visitID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.DATE, allowNull: false },
    time: { type: DataTypes.TIME, allowNull: false },
    duration: { type: DataTypes.INTEGER, allowNull: false },
    location: { type: DataTypes.STRING, allowNull: false },
    reason: { type: DataTypes.JSON, allowNull: false },
    checklist: { type: DataTypes.JSON, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    photos: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [], allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true },
    agentID: { type: DataTypes.INTEGER, allowNull: false }, 
    supervisorID: { type: DataTypes.INTEGER, allowNull: false }, 
});

// relationship
Visit.belongsTo(User, { foreignKey: 'supervisorID' });

module.exports = Visit;