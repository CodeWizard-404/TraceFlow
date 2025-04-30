// scripts/cleanup.js
const cron = require('node-cron');
const { TrustedDevice } = require('../models');
const { Op } = require('sequelize');

async function cleanupExpiredDevices() {
    await TrustedDevice.destroy({
        where: {
            status: 'inactive',
            expiresAt: { [Op.lt]: new Date() },
        },
    });
    console.log('Expired devices cleaned up');
}

// Schedule to run daily at midnight
cron.schedule('0 0 * * *', cleanupExpiredDevices);

console.log('Cleanup scheduler started');