const cron = require('node-cron');
const logger = require('../utils/logger');
const otpService = require('../services/otpService');
const NotificationService = require('../services/notificationService');
const { Timesheet } = require('../models');
const { Op } = require('sequelize');

function setupCron() {
    // Schedule hourly OTP cleanup
    cron.schedule('0 * * * *', async () => {
        try {
            logger.info('Cleaning up expired OTPs');
            await otpService.cleanupExpiredOTPs();
        } catch (error) {
            logger.error(`Error cleaning up OTPs: ${error.message}`);
        }
    });

    // Schedule daily timesheet reminder at 8 AM
    cron.schedule('0 8 * * *', async () => {
        try {
            logger.info('Checking for unsubmitted timesheets');
            const timesheets = await Timesheet.findAll({
                where: {
                    status: 'draft',
                    createdAt: { [Op.lte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                },
            });
            for (const timesheet of timesheets) {
                await NotificationService.triggerNotification({
                    event: 'timesheet:reminder',
                    data: { timesheetId: timesheet.timesheetID },
                    metadata: { userID: timesheet.supervisorID },
                });
            }
            logger.info(`Processed ${timesheets.length} timesheet reminders`);
        } catch (error) {
            logger.error(`Error processing timesheet reminders: ${error.message}`);
        }
    });
}

module.exports = { setupCron };