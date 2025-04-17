const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Timesheet', {
    timesheetID: { 
        type: DataTypes.STRING,     
        primaryKey: true,
        defaultValue: () => `ts_${nanoid()}`,
    },
    weekNumber: { type: DataTypes.INTEGER, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false },
    supervisorID: { type: DataTypes.STRING, allowNull: false }, 
});

};