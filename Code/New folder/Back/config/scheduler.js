const cron = require('node-cron');
const otpService = require('../services/otpService');
const { Visit, GeneratedReport, Timesheet, ReceiptBook, ReceiptStub, AIConfig } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { getRedisClient } = require('./redis');
const ReportService = require('../services/reportService');
const { ReportSchedule } = require('../models');
const NotificationService = require('../services/notificationService');
const AIService = require('../services/aiService');

// Function to set up all scheduled tasks
function setupCron() {
    // Task 1: Clean up expired OTPs
    // Runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
    cron.schedule('0 * * * *', async () => {
        try {
            // Call the OTP service to remove expired OTPs from the system
            await otpService.cleanupExpiredOTPs();
        } catch (error) {
            // Log an error if the cleanup fails
            logger.error(`Error cleaning up OTPs: ${error.message}`);
        }
    });

    // Task 2: Update pending visits to 'validated'
    // Runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
    // Rule: Changes visits with 'pending' status that are older than 24 hours to 'validated'
    cron.schedule('0 * * * *', async () => {
        try {
            // Calculate the time 24 hours ago
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            // Update visits in the database that are pending and older than 24 hours
            await Visit.update(
                { status: 'validated' },
                {
                    where: {
                        status: 'pending',
                        updatedAt: { [Op.lte]: twentyFourHoursAgo }, // Visits created before or at this time
                    },
                }
            );
        } catch (error) {
            // Log an error if the update fails
            logger.error(`Error updating visits: ${error.message}`);
        }
    });

    // Task 3: Clean up downloaded supplier files
    // Runs daily at midnight (00:00)
    // Rule: Deletes supplier files that have been downloaded and are older than 7 days
    cron.schedule('0 0 * * *', async () => {
        // Define the directory where supplier files are stored
        const supplierFilesDir = path.join(__dirname, '../Uploads/supplier_files');
        try {
            // Get all files in the supplier files directory
            const files = await fs.readdir(supplierFilesDir);
            // Get the Redis client for checking download status
            const redisClient = getRedisClient();
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

            // Loop through each file
            for (const file of files) {
                const filePath = path.join(supplierFilesDir, file);
                // Get file details (like modification time)
                const stats = await fs.stat(filePath);

                // Check if the file has been downloaded by looking in Redis
                const fileKeys = await redisClient.keys('file:*');
                let fileDownloaded = false;

                for (const fileKey of fileKeys) {
                    const fileData = await redisClient.hgetall(fileKey);
                    if (fileData.filePath === filePath && parseInt(fileData.downloadCount, 10) > 0) {
                        fileDownloaded = true;
                        break;
                    }
                }

                // Delete the file if it was downloaded and is older than 7 days
                if (fileDownloaded && now - stats.mtimeMs > sevenDays) {
                    try {
                        await fs.unlink(filePath); // Delete the file
                        logger.info('Deleted downloaded supplier file', { file, service: 'cron' });
                    } catch (err) {
                        // Log an error if file deletion fails
                        logger.error('Failed to delete supplier file', {
                            file,
                            error: err.message,
                            service: 'cron',
                        });
                    }
                }
            }
        } catch (error) {
            // Log an error if the cleanup process fails
            logger.error('Failed to clean up supplier files', {
                error: error.message,
                service: 'cron',
            });
        }
    });

    // Task 4: Generate scheduled reports
    // Runs based on each schedule's cron expression (varies per schedule)
    // Rule: Generates reports based on predefined schedules and notifies users
    ReportSchedule.findAll().then(schedules => {
        // Loop through each report schedule
        schedules.forEach(schedule => {
            cron.schedule(schedule.cronExpression, async () => {
                try {
                    // Check if the schedule still exists
                    const currentSchedule = await ReportSchedule.findByPk(schedule.scheduleID);
                    if (!currentSchedule) {
                        logger.info(`Schedule ${schedule.scheduleID} no longer exists, skipping report generation`, {
                            route: 'reports',
                            service: 'cron',
                        });
                        return;
                    }
                    let data;
                    // Generate the appropriate report based on the report type
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
                    // Export the report to a file
                    const filePath = await ReportService.exportReport(schedule.reportType, data, schedule.format);
                    // Save the report details in the database
                    await GeneratedReport.create({
                        reportType: schedule.reportType,
                        format: schedule.format,
                        filePath,
                        generatedBy: null,
                        scheduleID: schedule.scheduleID,
                    });
                    // Send a notification about the generated report
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
                    // Log an error if report generation fails
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

    // Task 5: Clean up old or frequently downloaded report files
    // Runs daily at midnight (00:00)
    // Rules: Deletes report files that are:
    // - Older than 7 days, OR
    // - Downloaded 5 or more times, OR
    // - Downloaded once and older than 24 hours
    cron.schedule('0 0 * * *', async () => {
        // Define the directory where reports are stored
        const reportsDir = path.join(__dirname, '../reports');
        try {
            // Get all files in the reports directory
            const files = await fs.readdir(reportsDir);
            const redisClient = getRedisClient();
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
            const oneDay = 24 * 60 * 60 * 1000; // 1 day in milliseconds

            // Loop through each file
            for (const file of files) {
                const filePath = path.join(reportsDir, file);
                // Get file details (like modification time)
                const stats = await fs.stat(filePath);

                // Check download status in Redis
                const fileKeys = await redisClient.keys('file:*');
                let downloadCount = 0;
                let fileKeyToDelete = null;

                for (const fileKey of fileKeys) {
                    const fileData = await redisClient.hgetall(fileKey);
                    if (fileData.filePath === filePath) {
                        downloadCount = parseInt(fileData.downloadCount, 10) || 0;
                        fileKeyToDelete = fileKey;
                        break;
                    }
                }

                // Delete the file if it meets any of the deletion rules
                if (
                    (now - stats.mtimeMs > sevenDays) ||
                    (downloadCount >= 5) ||
                    (downloadCount === 1 && now - stats.mtimeMs > oneDay)
                ) {
                    try {
                        await fs.unlink(filePath); // Delete the file
                        if (fileKeyToDelete) {
                            await redisClient.del(fileKeyToDelete); // Remove the Redis entry
                        }
                        // Log the reason for deletion
                        logger.info('Deleted report file', {
                            file,
                            service: 'cron',
                            reason:
                                now - stats.mtimeMs > sevenDays ? 'older than 7 days' :
                                    downloadCount >= 5 ? 'downloaded 5+ times' :
                                        'downloaded once and older than 24 hours'
                        });
                    } catch (err) {
                        // Log an error if file deletion fails
                        logger.error('Failed to delete report file', {
                            file,
                            error: err.message,
                            service: 'cron',
                        });
                    }
                }
            }
        } catch (error) {
            // Log an error if the cleanup process fails
            logger.error('Failed to clean up report files', {
                error: error.message,
                service: 'cron',
            });
        }
    });

    // Task 6: Reset AI configurations
    // Runs daily at midnight (00:00)
    // Rule: Resets AI configuration settings to their default values
    cron.schedule('0 0 * * *', async () => {
        try {
            logger.info('Resetting AI configurations to default values');
            // Get default AI configuration
            const defaultConfig = await AIService.initializeAI();
            // Update AIConfig model with default values
            await AIConfig.update(
                {
                    timesheetMaxSuggestions: defaultConfig.timesheetMaxSuggestions || 5,
                    maxOptimizeRoute: defaultConfig.maxOptimizeRoute || 5
                },
                { where: {} } // Update all records
            );
            logger.info('AI configurations reset successfully');
        } catch (error) {
            // Log an error if the reset fails
            logger.error('Failed to reset AI configurations', {
                error: error.message,
                service: 'cron',
            });
        }
    });

    // Task 7: Detect anomalies in API data
    // Runs daily at midnight (00:00)
    // Rule: Checks data from the previous day for anomalies in Visits, Timesheets, Receipt Books, and Receipt Stubs
    cron.schedule('0 0 * * *', async () => {
        try {
            logger.info('Starting scheduled anomaly detection for problematic APIs');
            // Define the time range for yesterday (00:00 to 23:59:59)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterdayStart = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            const yesterdayEnd = new Date(today.getTime() - 1);

            // Fetch data created yesterday
            const recentVisits = await Visit.findAll({
                where: {
                    createdAt: {
                        [Op.gte]: yesterdayStart, // Greater than or equal to yesterday's start
                        [Op.lte]: yesterdayEnd, // Less than or equal to yesterday's end
                    },
                },
            });

            const recentTimesheets = await Timesheet.findAll({
                where: {
                    createdAt: {
                        [Op.gte]: yesterdayStart,
                        [Op.lte]: yesterdayEnd,
                    },
                },
            });

            const recentReceiptBooks = await ReceiptBook.findAll({
                where: {
                    createdAt: {
                        [Op.gte]: yesterdayStart,
                        [Op.lte]: yesterdayEnd,
                    },
                },
            });

            const recentReceiptStubs = await ReceiptStub.findAll({
                where: {
                    createdAt: {
                        [Op.gte]: yesterdayStart,
                        [Op.lte]: yesterdayEnd,
                    },
                },
            });

            // List of APIs to check for anomalies
            const apiData = [
                { type: 'visit', data: recentVisits, name: 'Visits API' },
                { type: 'timesheet', data: recentTimesheets, name: 'Timesheets API' },
                { type: 'receipt_book', data: recentReceiptBooks, name: 'Receipt Books API' },
                { type: 'receipt_stub', data: recentReceiptStubs, name: 'Receipt Stubs API' },
            ];

            // Analyze each API for anomalies
            for (const { type, data, name } of apiData) {
                if (data.length > 0) {
                    logger.info(`Analyzing ${name} for anomalies`);
                    // Run anomaly detection
                    const anomalies = await AIService.detectAnomalies(type, data);
                    if (anomalies.length > 0) {
                        // Send a notification if anomalies are found
                        await NotificationService.triggerNotification({
                            event: 'ai:anomaly_detected',
                            data: { dataType: type, anomalyCount: anomalies.length },
                            metadata: { anomalies, apiName: name },
                        });
                        logger.info(`Detected ${anomalies.length} anomalies in ${name}`);
                    } else {
                        logger.info(`No anomalies detected in ${name}`);
                    }
                } else {
                    logger.info(`No data to analyze for ${name} from yesterday`);
                }
            }
        } catch (error) {
            // Log an error if anomaly detection fails
            logger.error('Error in scheduled anomaly detection', { error: error.message });
        }
    });
}

// Export the setupCron function to be used elsewhere
module.exports = { setupCron };