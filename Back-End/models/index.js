const { sequelize } = require('../config/db');
const DataTypes = require('sequelize').DataTypes;

const Agent = require('./agent')(sequelize, DataTypes);
const User = require('./user')(sequelize, DataTypes);
const Visit = require('./visit')(sequelize, DataTypes);
const Timesheet = require('./timesheet')(sequelize, DataTypes);

// Define associations
const setupAssociations = () => {
  // User-Visit relations
  User.hasMany(Visit, { foreignKey: 'supervisorID' });
  Visit.belongsTo(User, { foreignKey: 'supervisorID' });

  // Agent-Visit relations
  Agent.hasMany(Visit, { foreignKey: 'agentID' });
  Visit.belongsTo(Agent, { foreignKey: 'agentID' });

  // Timesheet-Visit relations
  Timesheet.hasMany(Visit, { foreignKey: 'timesheetID' });
  Visit.belongsTo(Timesheet, { foreignKey: 'timesheetID' });

  // User-Timesheet relations
  User.hasMany(Timesheet, { foreignKey: 'supervisorID' });
  Timesheet.belongsTo(User, { foreignKey: 'supervisorID' });
};

module.exports = {
  sequelize,
  Agent,
  User,
  Visit,
  Timesheet,
  setupAssociations
};