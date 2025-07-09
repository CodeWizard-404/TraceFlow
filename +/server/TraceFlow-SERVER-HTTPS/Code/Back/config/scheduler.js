const cron = require('node-cron');
const otpService = require('../services/otpService');
const { Visit } = require('../models');
const { Op } = require('sequelize');

function setupCron() {
    // Schedule hourly OTP cleanup
    cron.schedule('0 * * * *', async () => {
        try {
            await otpService.cleanupExpiredOTPs();
        } catch (error) {
            console.error(`Error cleaning up OTPs: ${error.message}`);
        }
    });

    // Schedule hourly visit status update
    cron.schedule('0 * * * *', async () => {
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            await Visit.update(
                { status: 'validated' },
                {
                    where: {
                        status: 'pending',
                        createdAt: { [Op.lte]: twentyFourHoursAgo },
                    },
                }
            );
        } catch (error) {
            console.error(`Error updating visits: ${error.message}`);
        }
    });
}

module.exports = { setupCron };