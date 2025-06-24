const { initializeDatabase, sequelize } = require('./db');
const { initializeServer } = require('./server');
const { initializeSMS } = require('./sms');
const { initializeSMTP } = require('./smtp');
const { initializeRedis } = require('./redis');
const { initializeGoogleServices } = require('./google');

module.exports = {
    initializeDatabase,
    initializeSMTP,
    initializeSMS,
    initializeServer,
    initializeRedis,
    initializeGoogleServices,
    sequelize,
};