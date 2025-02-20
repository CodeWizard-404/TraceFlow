const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Load all models
fs.readdirSync(__dirname)
    .filter(file => {
        return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
    })
    .forEach(file => {
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
    });

// Define relationships
Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

// Explicitly define relationships
db.User.hasMany(db.Visit, { foreignKey: 'supervisorID' });
db.Visit.belongsTo(db.User, { foreignKey: 'supervisorID' });

db.Agent.hasMany(db.Visit, { foreignKey: 'agentID' });
db.Visit.belongsTo(db.Agent, { foreignKey: 'agentID' });

db.Timesheet.hasMany(db.Visit, { foreignKey: 'timesheetID' });
db.Visit.belongsTo(db.Timesheet, { foreignKey: 'timesheetID' });

db.User.hasMany(db.Timesheet, { foreignKey: 'supervisorID' });
db.Timesheet.belongsTo(db.User, { foreignKey: 'supervisorID' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;