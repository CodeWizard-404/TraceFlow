// models/reportSchedule.js
const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('ReportSchedule', {
        scheduleID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `sch_${nanoid()}`,
        },
        reportType: {
            type: DataTypes.ENUM(
                'VisitSummary',
                'Timesheet',
                'ReceiptBookInventory',
                'StubCollection',
                'UserActivity',
                'Anomaly',
                'AgentPerformance',
                'RegionPerformance',
                'Full'
            ),
            allowNull: false,
        },
        filters: {
            type: DataTypes.TEXT,
            allowNull: false,
            get() {
                return JSON.parse(this.getDataValue('filters'));
            },
            set(value) {
                this.setDataValue('filters', JSON.stringify(value));
            },
        },
        format: {
            type: DataTypes.ENUM('pdf', 'excel'),
            allowNull: false,
        },
        cronExpression: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        createdBy: {
            type: DataTypes.STRING,
            allowNull: false,
            references: { model: 'Users', key: 'userID' },
        },
    });
};