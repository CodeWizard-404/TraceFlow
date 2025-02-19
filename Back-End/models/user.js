const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Visit = require('../visit'); 

const User = sequelize.define('User', {
    userID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    lastname: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: true },
    role: { type: DataTypes.STRING, allowNull: true },
});

// relationships
User.hasMany(Visit, { foreignKey: 'supervisorID' });
User.hasMany(Timesheet, { foreignKey: 'supervisorID' });

module.exports = User;