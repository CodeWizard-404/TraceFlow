const { DataTypes } = require('sequelize');
const { nanoid } = require('nanoid');
const sequelize = require('../config/db');

const Agent = sequelize.define('Agent', {
    agentID: { 
        type: DataTypes.STRING,     
        primaryKey: true,
        defaultValue: () => nanoid(), 
    },
    name: { type: DataTypes.STRING, allowNull: false },
    lastname: { type: DataTypes.STRING, allowNull: false },
    cin: { type: DataTypes.STRING, unique: true, allowNull: false }, 
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
});

module.exports = Agent;