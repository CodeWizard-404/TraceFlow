const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Visit', {
        visitID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `vis_${nanoid()}`,
        },
        date: { type: DataTypes.DATEONLY, allowNull: false },
        time: { type: DataTypes.TIME, allowNull: false },
        duration: { type: DataTypes.INTEGER },
        location: { type: DataTypes.STRING },
        status: { type: DataTypes.STRING, allowNull: false },
        photos: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
        comment: { type: DataTypes.TEXT },
        agentID: { type: DataTypes.STRING, allowNull: false },
        timesheetID: { type: DataTypes.STRING, allowNull: false },
        calendarEventId: { type: DataTypes.STRING },
    });
};