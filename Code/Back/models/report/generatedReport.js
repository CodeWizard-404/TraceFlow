// models/generatedReport.js
const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define('GeneratedReport', {
    generatedReportID: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => `gr_${nanoid()}`,
    },
    reportType: {
      type: DataTypes.ENUM(
        'VisitSummary',
        'Timesheet',
        'ReceiptBookInventory',
        'StubCollection',
        'UserActivity',
        'AIAnomaly',
        'AgentPerformance',
        'RegionPerformance',
        'Full'
      ),
      allowNull: false,
    },
    format: {
      type: DataTypes.ENUM('pdf', 'excel'),
      allowNull: false,
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    generatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    generatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
      references: { model: 'Users', key: 'userID' },
    },
    scheduleID: {
      type: DataTypes.STRING,
      allowNull: true,
      references: { model: 'ReportSchedules', key: 'scheduleID' },
    },
  });
};