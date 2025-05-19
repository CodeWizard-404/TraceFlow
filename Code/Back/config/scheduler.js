const cron = require('node-cron');
const otpService = require('../services/otpService');
const { Visit } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { getRedisClient } = require('./redis');

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

    // Clean up supplier files with downloadCount >= 1 and older than 7 days
    cron.schedule('0 0 * * *', async () => {
        const supplierFilesDir = path.join(__dirname, '../Uploads/supplier_files');
        try {
            const files = await fs.readdir(supplierFilesDir);
            const redisClient = getRedisClient();
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;

            for (const file of files) {
                const filePath = path.join(supplierFilesDir, file);
                const stats = await fs.stat(filePath);

                // Find the corresponding Redis entry (if any)
                const fileKeys = await redisClient.keys('file:*');
                let fileDownloaded = false;

                for (const fileKey of fileKeys) {
                    const fileData = await redisClient.hgetall(fileKey);
                    if (fileData.filePath === filePath && parseInt(fileData.downloadCount, 10) > 0) {
                        fileDownloaded = true;
                        break;
                    }
                }

                // Delete only if file has been downloaded and is older than 7 days
                if (fileDownloaded && now - stats.mtimeMs > sevenDays) {
                    try {
                        await fs.unlink(filePath);
                        logger.info('Deleted downloaded supplier file', { file, service: 'cron' });
                    } catch (err) {
                        logger.error('Failed to delete supplier file', {
                            file,
                            error: err.message,
                            service: 'cron',
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to clean up supplier files', {
                error: error.message,
                service: 'cron',
            });
        }
    });
}

module.exports = { setupCron };