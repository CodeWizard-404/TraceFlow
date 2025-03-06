const { sequelize } = require('../config/db');
const DataTypes = require('sequelize').DataTypes;

const Agent = require('./agent')(sequelize, DataTypes);
const User = require('./user')(sequelize, DataTypes);
const Visit = require('./visit')(sequelize, DataTypes);
const Timesheet = require('./timesheet')(sequelize, DataTypes);
const Checklist = require('./checklist')(sequelize, DataTypes);
const VisitChecklist = require('./VisitChecklists')(sequelize, DataTypes);
const Reason = require('./reason')(sequelize, DataTypes);

// Define associations
const setupAssociations = () => {

    // Agent-Visit relations
    Agent.hasMany(Visit, { foreignKey: 'agentID' });
    Visit.belongsTo(Agent, { foreignKey: 'agentID' });

    // Timesheet-Visit relations
    Timesheet.hasMany(Visit, { foreignKey: 'timesheetID' });
    Visit.belongsTo(Timesheet, { foreignKey: 'timesheetID' });

    // User-Timesheet relations
    User.hasMany(Timesheet, { foreignKey: 'supervisorID' });
    Timesheet.belongsTo(User, { foreignKey: 'supervisorID' });

    // Visit-checklist relations
    Visit.belongsToMany(Checklist, {
        through: { model: VisitChecklist, unique: false },
        foreignKey: 'visitID',
        otherKey: 'checklistID'
    });
    Checklist.belongsToMany(Visit, {
        through: { model: VisitChecklist, unique: false },
        foreignKey: 'checklistID',
        otherKey: 'visitID'
    });

    // Visit-reason relations
    Visit.belongsToMany(Reason, {
        through: 'VisitReasons',
        foreignKey: 'visitID',
        otherKey: 'reasonID'
    });
    Reason.belongsToMany(Visit, {
        through: 'VisitReasons',
        foreignKey: 'reasonID',
        otherKey: 'visitID'
    });

};

module.exports = {
    sequelize,
    User, Agent, Visit, Timesheet, Checklist, Reason,
    setupAssociations
};