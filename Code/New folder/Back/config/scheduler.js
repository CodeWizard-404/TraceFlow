// utils/cron.js
const cron = require('node-cron');
const otpService = require('../services/otpService');
const { Visit, GeneratedReport } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { getRedisClient } = require('./redis');
const ReportService = require('../services/reportService');
const { ReportSchedule } = require('../models');
const NotificationService = require('../services/notificationService');

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
        const supplierFilesDir = path.join(__dirname, '../uploads/supplier_files');
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

    // Load and schedule existing report schedules
    ReportSchedule.findAll().then(schedules => {
        schedules.forEach(schedule => {
            cron.schedule(schedule.cronExpression, async () => {
                try {
                    const currentSchedule = await ReportSchedule.findByPk(schedule.scheduleID);
                    if (!currentSchedule) {
                        logger.info(`Schedule ${schedule.scheduleID} no longer exists, skipping report generation`, {
                            route: 'reports',
                            service: 'cron',
                        });
                        return;
                    }
                    let data;
                    switch (schedule.reportType) {
                        case 'VisitSummary':
                            data = await ReportService.generateVisitSummaryReport(schedule.filters);
                            break;
                        case 'Timesheet':
                            data = await ReportService.generateTimesheetReport(schedule.filters);
                            break;
                        case 'ReceiptBookInventory':
                            data = await ReportService.generateReceiptBookInventoryReport(schedule.filters);
                            break;
                        case 'StubCollection':
                            data = await ReportService.generateStubCollectionReport(schedule.filters);
                            break;
                        case 'UserActivity':
                            data = await ReportService.generateUserActivityReport(schedule.filters);
                            break;
                        case 'AIAnomaly':
                            data = await ReportService.generateAIAnomalyReport(schedule.filters);
                            break;
                        case 'AgentPerformance':
                            data = await ReportService.generateAgentPerformanceReport(schedule.filters);
                            break;
                        case 'RegionPerformance':
                            data = await ReportService.generateRegionPerformanceReport(schedule.filters);
                            break;
                        case 'Full':
                            data = await ReportService.generateFullReport(schedule.filters);
                            break;
                    }
                    const filePath = await ReportService.exportReport(schedule.reportType, data, schedule.format);
                    await GeneratedReport.create({
                        reportType: schedule.reportType,
                        format: schedule.format,
                        filePath,
                        generatedBy: null,
                        scheduleID: schedule.scheduleID,
                    });
                    await NotificationService.triggerNotification({
                        event: 'report:generated',
                        data: { reportType: schedule.reportType, format: schedule.format, filePath: path.basename(filePath) },
                        metadata: { scheduleID: schedule.scheduleID },
                    });
                    logger.info(`Scheduled ${schedule.reportType} report generated`, {
                        route: 'reports',
                        service: 'cron',
                        status: 200,
                        metadata: { reportType: schedule.reportType, scheduleID: schedule.scheduleID },
                    });
                } catch (error) {
                    logger.error(`Scheduled report generation failed: ${error.message}`, {
                        route: 'reports',
                        service: 'cron',
                        status: 500,
                        metadata: { reportType: schedule.reportType, scheduleID: schedule.scheduleID, error: error.message },
                    });
                }
            });
        });
    }).catch(error => logger.error('Failed to load report schedules', {
        route: 'reports',
        service: 'cron',
        status: 500,
        metadata: { error: error.message },
    }));

    // Clean up old report files
    cron.schedule('0 0 * * *', async () => {
        const reportsDir = path.join(__dirname, '../reports');
        try {
            const files = await fs.readdir(reportsDir);
            const now = Date.now();
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;

            for (const file of files) {
                const filePath = path.join(reportsDir, file);
                const stats = await fs.stat(filePath);
                if (now - stats.mtimeMs > thirtyDays) {
                    await fs.unlink(filePath);
                    logger.info('Deleted old report file', { file, service: 'cron' });
                }
            }
        } catch (error) {
            logger.error('Failed to clean up report files', {
                error: error.message,
                service: 'cron',
            });
        }
    });
}

module.exports = { setupCron };