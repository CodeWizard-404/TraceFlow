const { initializeDatabase, sequelize } = require('./db');
const { initializeServer } = require('./server');
const { initializeSMS } = require('./sms');
const { initializeSMTP } = require('./smtp');

module.exports = {
    initializeDatabase,
    initializeSMTP,
    initializeSMS,
    initializeServer,
    sequelize,
};