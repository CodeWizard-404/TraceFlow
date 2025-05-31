const ReportService = require('../services/reportService');
const NotificationService = require('../services/notificationService');
const { ReportSchedule, GeneratedReport, User } = require('../models');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

class ReportController {
    static validReportTypes = [
        'VisitSummary',
        'Timesheet',
        'ReceiptBookInventory',
        'StubCollection',
        'UserActivity',
        'AIAnomaly',
        'AgentPerformance',
        'RegionPerformance',
        'Full'
    ];

    static validFormats = ['pdf', 'excel'];

    static validateInput(reportType, format, cronExpression) {
        if (!this.validReportTypes.includes(reportType)) {
            throw new Error('Invalid report type');
        }
        if (!this.validFormats.includes(format)) {
            throw new Error('Invalid format. Use "pdf" or "excel"');
        }
        if (cronExpression && !cron.validate(cronExpression)) {
            throw new Error('Invalid cron expression');
        }
    }

    static async generateReport(req, res) {
        const { reportType, filters = {}, format } = req.body;
        const traceId = req.traceId || 'unknown';
        const userId = req.user?.userID;

        if (!userId) {
            logger.error('User ID is missing in request', { traceId, route: 'reports', service: 'api', status: 401 });
            return res.status(401).json({ error: 'Unauthorized: User ID missing' });
        }

        try {
            ReportController.validateInput(reportType, format);

            logger.debug(`Generating ${reportType} report`, {
                traceId, route: 'reports', service: 'api',
                metadata: { filters, userId }
            });

            const reportMethod = {
                'VisitSummary': ReportService.generateVisitSummaryReport,
                'Timesheet': ReportService.generateTimesheetReport,
                'ReceiptBookInventory': ReportService.generateReceiptBookInventoryReport,
                'StubCollection': ReportService.generateStubCollectionReport,
                'UserActivity': ReportService.generateUserActivityReport,
                'AIAnomaly': ReportService.generateAIAnomalyReport,
                'AgentPerformance': ReportService.generateAgentPerformanceReport,
                'RegionPerformance': ReportService.generateRegionPerformanceReport,
                'Full': ReportService.generateFullReport
            }[reportType];

            if (!reportMethod || typeof reportMethod !== 'function') {
                throw new Error(`Invalid report method for reportType: ${reportType}`);
            }

            const data = await reportMethod(filters);
            const filePath = await ReportService.exportReport(reportType, data, format);
            const fileName = path.basename(filePath);

            await GeneratedReport.create({
                reportType,
                format,
                filePath: fileName,
                generatedBy: userId
            });

            await NotificationService.triggerNotification({
                event: 'report:generated',
                data: { reportType, format, filters },
                metadata: { triggeredBy: req.user.email }
            });

            logger.info(`Generated ${reportType} report`, {
                traceId, route: 'reports', service: 'api', status: 200,
                metadata: { reportType, format, file: fileName, userId }
            });

            return res.status(200).json({
                message: 'Report generated successfully',
                reportPath: `/api/reports/download?file=${fileName}`
            });
        } catch (error) {
            logger.error(`Failed to generate ${reportType} report: ${error.message}`, {
                traceId, route: 'reports', service: 'api', status: 400,
                metadata: { userId, error: error.message }
            });
            return res.status(400).json({ error: error.message });
        }
    }

    static async scheduleReport(req, res) {
        const { reportType, filters = {}, format, cronExpression } = req.body;
        const traceId = req.traceId || 'unknown';
        const userId = req.user?.userID;

        if (!userId) {
            logger.error('User ID is missing in request', { traceId, route: 'reports', service: 'api', status: 401 });
            return res.status(401).json({ error: 'Unauthorized: User ID missing' });
        }

        try {
            ReportController.validateInput(reportType, format, cronExpression);

            const schedule = await ReportSchedule.create({
                reportType,
                filters: JSON.stringify(filters),
                format,
                cronExpression,
                createdBy: userId
            });

            cron.schedule(cronExpression, async () => {
                try {
                    const currentSchedule = await ReportSchedule.findByPk(schedule.scheduleID);
                    if (!currentSchedule) {
                        logger.info(`Schedule ${schedule.scheduleID} no longer exists`, {
                            route: 'reports', service: 'cron'
                        });
                        return;
                    }

                    const reportMethod = {
                        'VisitSummary': ReportService.generateVisitSummaryReport,
                        'Timesheet': ReportService.generateTimesheetReport,
                        'ReceiptBookInventory': ReportService.generateReceiptBookInventoryReport,
                        'StubCollection': ReportService.generateStubCollectionReport,
                        'UserActivity': ReportService.generateUserActivityReport,
                        'AIAnomaly': ReportService.generateAIAnomalyReport,
                        'AgentPerformance': ReportService.generateAgentPerformanceReport,
                        'RegionPerformance': ReportService.generateRegionPerformanceReport,
                        'Full': ReportService.generateFullReport
                    }[reportType];

                    const data = await reportMethod(filters);
                    const filePath = await ReportService.exportReport(reportType, data, format);
                    const fileName = path.basename(filePath);

                    await GeneratedReport.create({
                        reportType,
                        format,
                        filePath: fileName,
                        scheduleID: schedule.scheduleID
                    });

                    await NotificationService.triggerNotification({
                        event: 'report:generated',
                        data: { reportType, format, fileName },
                        metadata: { scheduleID: schedule.scheduleID },
                    });

                    logger.info(`Scheduled ${reportType} report generated`, {
                        route: 'reports', service: 'cron', status: 200,
                        metadata: { reportType, scheduleID: schedule.scheduleID }
                    });
                } catch (error) {
                    logger.error(`Scheduled ${reportType} report failed: ${error.message}`, {
                        route: 'reports', service: 'cron', status: 500,
                        metadata: { reportType, scheduleID: schedule.scheduleID, error: error.message }
                    });
                }
            });

            await NotificationService.triggerNotification({
                event: 'report:scheduled',
                data: { reportType, format, cronExpression, scheduleID: schedule.scheduleID },
                metadata: { triggeredBy: req.user.email }
            });

            logger.info(`Scheduled ${reportType} report`, {
                traceId, route: 'reports', service: 'api', status: 200,
                metadata: { userId, scheduleID: schedule.scheduleID }
            });

            return res.status(200).json({
                message: 'Report scheduled successfully',
                scheduleID: schedule.scheduleID
            });
        } catch (error) {
            logger.error(`Failed to schedule ${reportType} report: ${error.message}`, {
                traceId, route: 'reports', service: 'api', status: '400',
                metadata: { userId, error: error.message }
            });
            return res.status(400).json({ error: error.message });
        }
    }

    static async downloadReport(req, res) {
        const { file } = req.query;
        const traceId = req.traceId || 'unknown';
        const userId = req.user?.userID;

        if (!userId) {
            logger.error('User ID is missing in request', { traceId, route: 'reports', service: 'api', status: 401 });
            return res.status(401).json({ error: 'Unauthorized: User ID missing' });
        }

        try {
            if (!file || typeof file !== 'string') {
                throw new Error('Valid file name is required');
            }

            const fileName = path.basename(file);
            const filePath = path.join(__dirname, '../reports', fileName);

            // Check if file exists
            try {
                await fs.access(filePath);
            } catch {
                throw new Error('Report file not found');
            }

            logger.info(`Initiating download for report ${fileName}`, {
                traceId, route: 'reports', service: 'api', status: 200,
                metadata: { file: fileName, userId }
            });

            // Use res.download with an error-handling callback
            res.download(filePath, fileName, (err) => {
                if (err) {
                    logger.error(`Failed to download report ${fileName}: ${err.message}`, {
                        traceId, route: 'reports', service: 'api', status: 500,
                        metadata: { userId, file: fileName, error: err.message }
                    });
                    // Avoid sending response if headers are already sent
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Failed to download report' });
                    }
                } else {
                    logger.info(`Successfully downloaded report ${fileName}`, {
                        traceId, route: 'reports', service: 'api', status: 200,
                        metadata: { userId, file: fileName }
                    });
                }
            });
        } catch (error) {
            const status = error.message.includes('not found') ? 404 : 400;
            logger.error(`Failed to download report: ${error.message}`, {
                traceId, route: 'reports', service: 'api', status,
                metadata: { userId, file, error: error.message }
            });
            return res.status(status).json({ error: error.message });
        }
    }

    static async listSchedules(req, res) {
        const traceId = req.traceId || 'unknown';
        const userId = req.user?.userID;

        if (!userId) {
            logger.error('User ID is missing in request', { traceId, route: 'reports', service: 'api', status: 401 });
            return res.status(401).json({ error: 'Unauthorized: User ID missing' });
        }

        try {
            const schedules = await ReportSchedule.findAll({
                attributes: ['scheduleID', 'reportType', 'format', 'cronExpression', 'createdBy', 'createdAt'],
                include: [{
                    model: User,
                    attributes: ['userID', 'firstname', 'lastname'],
                    as: 'Creator'
                }]
            });

            logger.info('Listed report schedules', {
                traceId, route: 'reports', service: 'api', status: 200,
                metadata: { userId, count: schedules.length }
            });

            return res.status(200).json(schedules);
        } catch (error) {
            logger.error(`Failed to list schedules: ${error.message}`, {
                traceId, route: 'reports', service: 'api', status: 500,
                metadata: { userId, error: error.message }
            });
            return res.status(500).json({ error: 'Failed to list report schedules' });
        }
    }

    static async listGeneratedReports(req, res) {
        const traceId = req.traceId || 'unknown';
        const userId = req.user?.userID;

        if (!userId) {
            logger.error('User ID is missing in request', { traceId, route: 'reports', service: 'api', status: 401 });
            return res.status(401).json({ error: 'Unauthorized: User ID missing' });
        }

        try {
            const reports = await GeneratedReport.findAll({
                attributes: ['generatedReportID', 'reportType', 'format', 'filePath', 'generatedAt', 'generatedBy', 'scheduleID'],
                include: [
                    {
                        model: User,
                        attributes: ['userID', 'firstname', 'lastname'],
                        as: 'Generator'
                    },
                    {
                        model: ReportSchedule,
                        attributes: ['scheduleID', 'reportType', 'format', 'cronExpression'],
                        as: 'Schedule'
                    }
                ],
                order: [['generatedAt', 'DESC']]
            });

            logger.info('Listed generated reports', {
                traceId, route: 'reports', service: 'api', status: 200,
                metadata: { userId, count: reports.length }
            });

            return res.status(200).json(reports);
        } catch (error) {
            logger.error(`Failed to list generated reports: ${error.message}`, {
                traceId, route: 'reports', service: 'api', status: 500,
                metadata: { userId, error: error.message }
            });
            return res.status(500).json({ error: 'Failed to list generated reports' });
        }
    }

    static async deleteSchedule(req, res) {
        const { scheduleID } = req.params;
        const traceId = req.traceId || 'unknown';
        const userId = req.user?.userID;

        if (!userId) {
            logger.error('User ID is missing in request', { traceId, route: 'reports', service: 'api', status: 401 });
            return res.status(401).json({ error: 'Unauthorized: User ID missing' });
        }

        try {
            const schedule = await ReportSchedule.findByPk(scheduleID);
            if (!schedule) {
                logger.warn(`Schedule ${scheduleID} not found`, {
                    traceId, route: 'reports', service: 'api', status: 404,
                    metadata: { userId }
                });
                return res.status(404).json({ error: 'Schedule not found' });
            }

            await schedule.destroy();

            logger.info(`Deleted schedule ${scheduleID}`, {
                traceId, route: 'reports', service: 'api', status: 200,
                metadata: { userId, scheduleID }
            });

            return res.status(200).json({ message: 'Schedule deleted successfully' });
        } catch (error) {
            logger.error(`Failed to delete schedule: ${error.message}`, {
                traceId, route: 'reports', service: 'api', status: 500,
                metadata: { userId, scheduleID, error: error.message }
            });
            return res.status(500).json({ error: 'Failed to delete schedule' });
        }
    }

    static async deleteGeneratedReport(req, res) {
        const { reportID } = req.params;
        const traceId = req.traceId || 'unknown';
        const userId = req.user?.userID;

        if (!userId) {
            logger.error('User ID is missing in request', { traceId, route: 'reports', service: 'api', status: 401 });
            return res.status(401).json({ error: 'Unauthorized: User ID missing' });
        }

        try {
            const report = await GeneratedReport.findByPk(reportID);
            if (!report) {
                logger.warn(`Generated report ${reportID} not found`, {
                    traceId, route: 'reports', service: 'api', status: 404,
                    metadata: { userId }
                });
                return res.status(404).json({ error: 'Generated report not found' });
            }

            await report.destroy();

            logger.info(`Deleted generated report ${reportID}`, {
                traceId, route: 'reports', service: 'api', status: 200,
                metadata: { userId, reportID }
            });

            return res.status(200).json({ message: 'Generated report deleted successfully' });
        } catch (error) {
            logger.error(`Failed to delete generated report: ${error.message}`, {
                traceId, route: 'reports', service: 'api', status: 500,
                metadata: { userId, reportID, error: error.message }
            });
            return res.status(500).json({ error: 'Failed to delete generated report' });
        }
    }
}

module.exports = ReportController;