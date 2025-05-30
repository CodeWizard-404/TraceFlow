// controllers/reportController.js
const ReportService = require('../services/reportService');
const NotificationService = require('../services/notificationService');
const { ReportSchedule, GeneratedReport, User } = require('../models');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class ReportController {
    static async generateReport(req, res) {
        try {
            const { reportType, filters = {}, format } = req.body;

            if (!['pdf', 'excel'].includes(format)) {
                logger.error('Invalid format specified', {
                    traceId: req.traceId,
                    route: 'reports',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: 'Invalid format', format },
                });
                return res.status(400).json({ error: 'Invalid format. Use "pdf" or "excel"' });
            }

            const validReportTypes = [
                'VisitSummary',
                'Timesheet',
                'ReceiptBookInventory',
                'StubCollection',
                'UserActivity',
                'AIAnomaly',
                'AgentPerformance',
                'RegionPerformance',
                'Full',
            ];
            if (!validReportTypes.includes(reportType)) {
                logger.error('Invalid report type', {
                    traceId: req.traceId,
                    route: 'reports',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: 'Invalid report type', reportType },
                });
                return res.status(400).json({ error: 'Invalid report type' });
            }

            logger.debug(`Generating ${reportType} report with filters`, {
                traceId: req.traceId,
                route: 'reports',
                service: 'api',
                metadata: { filters, userId: req.user.userID },
            });

            let data;
            switch (reportType) {
                case 'VisitSummary':
                    data = await ReportService.generateVisitSummaryReport(filters);
                    break;
                case 'Timesheet':
                    data = await ReportService.generateTimesheetReport(filters);
                    break;
                case 'ReceiptBookInventory':
                    data = await ReportService.generateReceiptBookInventoryReport(filters);
                    break;
                case 'StubCollection':
                    data = await ReportService.generateStubCollectionReport(filters);
                    break;
                case 'UserActivity':
                    data = await ReportService.generateUserActivityReport(filters);
                    break;
                case 'AIAnomaly':
                    data = await ReportService.generateAIAnomalyReport(filters);
                    break;
                case 'AgentPerformance':
                    data = await ReportService.generateAgentPerformanceReport(filters);
                    break;
                case 'RegionPerformance':
                    data = await ReportService.generateRegionPerformanceReport(filters);
                    break;
                case 'Full':
                    data = await ReportService.generateFullReport(filters);
                    break;
            }

            const filePath = await ReportService.exportReport(reportType, data, format);

            await GeneratedReport.create({
                reportType,
                format,
                filePath,
                generatedBy: req.user.userID,
                scheduleID: null,
            });

            await NotificationService.triggerNotification({
                event: 'report:generated',
                data: { reportType, format, filters },
                metadata: { triggeredBy: req.user.email },
            });

            logger.info(`Generated ${reportType} report`, {
                traceId: req.traceId,
                route: 'reports',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { reportType, format, file: path.basename(filePath), triggeredBy: req.user.email },
            });

            return res.status(200).json({ reportPath: `/api/reports/download?file=${path.basename(filePath)}` });
        } catch (error) {
            logger.error(`Failed to generate report: ${error.message}`, {
                traceId: req.traceId,
                route: 'reports',
                service: 'api',
                status: error.status || 500,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: error.message, stack: error.stack },
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to generate report' });
        }
    }

    static async scheduleReport(req, res) {
        try {
            const { reportType, filters = {}, format, cronExpression } = req.body;

            if (!['pdf', 'excel'].includes(format)) {
                logger.error('Invalid format specified', {
                    traceId: req.traceId,
                    route: 'reports',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: 'Invalid format', format },
                });
                return res.status(400).json({ error: 'Invalid format. Use "pdf" or "excel"' });
            }

            const validReportTypes = [
                'VisitSummary',
                'Timesheet',
                'ReceiptBookInventory',
                'StubCollection',
                'UserActivity',
                'AIAnomaly',
                'AgentPerformance',
                'RegionPerformance',
                'Full',
            ];
            if (!validReportTypes.includes(reportType)) {
                logger.error('Invalid report type', {
                    traceId: req.traceId,
                    route: 'reports',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: 'Invalid report type', reportType },
                });
                return res.status(400).json({ error: 'Invalid report type' });
            }

            if (!cron.validate(cronExpression)) {
                logger.error('Invalid cron expression', {
                    traceId: req.traceId,
                    route: 'reports',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: 'Invalid cron expression', cronExpression },
                });
                return res.status(400).json({ error: 'Invalid cron expression' });
            }

            const schedule = await ReportSchedule.create({
                reportType,
                filters: JSON.stringify(filters),
                format,
                cronExpression,
                createdBy: req.user.userID,
            });

            cron.schedule(cronExpression, async () => {
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
                    switch (reportType) {
                        case 'VisitSummary':
                            data = await ReportService.generateVisitSummaryReport(filters);
                            break;
                        case 'Timesheet':
                            data = await ReportService.generateTimesheetReport(filters);
                            break;
                        case 'ReceiptBookInventory':
                            data = await ReportService.generateReceiptBookInventoryReport(filters);
                            break;
                        case 'StubCollection':
                            data = await ReportService.generateStubCollectionReport(filters);
                            break;
                        case 'UserActivity':
                            data = await ReportService.generateUserActivityReport(filters);
                            break;
                        case 'AIAnomaly':
                            data = await ReportService.generateAIAnomalyReport(filters);
                            break;
                        case 'AgentPerformance':
                            data = await ReportService.generateAgentPerformanceReport(filters);
                            break;
                        case 'RegionPerformance':
                            data = await ReportService.generateRegionPerformanceReport(filters);
                            break;
                        case 'Full':
                            data = await ReportService.generateFullReport(filters);
                            break;
                    }
                    const filePath = await ReportService.exportReport(reportType, data, format);
                    await GeneratedReport.create({
                        reportType,
                        format,
                        filePath,
                        generatedBy: null,
                        scheduleID: schedule.scheduleID,
                    });
                    await NotificationService.triggerNotification({
                        event: 'report:generated',
                        data: { reportType, format, filePath: path.basename(filePath) },
                        metadata: { scheduleID: schedule.scheduleID },
                    });
                    logger.info(`Scheduled ${reportType} report generated`, {
                        route: 'reports',
                        service: 'cron',
                        status: 200,
                        metadata: { reportType, scheduleID: schedule.scheduleID },
                    });
                } catch (error) {
                    logger.error(`Scheduled report generation failed: ${error.message}`, {
                        route: 'reports',
                        service: 'cron',
                        status: 500,
                        metadata: { reportType, scheduleID: schedule.scheduleID, error: error.message },
                    });
                }
            });

            await NotificationService.triggerNotification({
                event: 'report:scheduled',
                data: { reportType, format, cronExpression, scheduleID: schedule.scheduleID },
                metadata: { triggeredBy: req.user.email },
            });

            logger.info(`Scheduled ${reportType} report`, {
                traceId: req.traceId,
                route: 'reports',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { reportType, format, scheduleID: schedule.scheduleID, createdBy: req.user.email },
            });

            return res.status(200).json({ message: 'Report scheduled successfully', scheduleID: schedule.scheduleID });
        } catch (error) {
            logger.error(`Failed to schedule report: ${error.message}`, {
                traceId: req.traceId,
                route: 'reports',
                service: 'api',
                status: error.status || 500,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: error.message, stack: error.stack },
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to schedule report' });
        }
    }

    static async downloadReport(req, res) {
        try {
            const { file } = req.query;
            if (!file) {
                logger.error('File name is required', {
                    traceId: req.traceId,
                    route: 'reports',
                    service: 'api',
                    status: 400,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: 'File name is required' },
                });
                return res.status(400).json({ error: 'File name is required' });
            }

            const filePath = path.join(__dirname, '../reports', file);
            if (!(await fs.access(filePath).then(() => true).catch(() => false))) {
                logger.error('Report file not found', {
                    traceId: req.traceId,
                    route: 'reports',
                    service: 'api',
                    status: 404,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: req.user.userID,
                    metadata: { error: 'Report file not found', file },
                });
                return res.status(404).json({ error: 'Report not found' });
            }

            res.download(filePath, (err) => {
                if (err) {
                    logger.error(`Failed to download report: ${err.message}`, {
                        traceId: req.traceId,
                        route: 'reports',
                        service: 'api',
                        status: 500,
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        userId: req.user.userID,
                        metadata: { error: err.message, file },
                    });
                } else {
                    logger.info(`Downloaded report ${file}`, {
                        traceId: req.traceId,
                        route: 'reports',
                        service: 'api',
                        status: 200,
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        userId: req.user.userID,
                        metadata: { file, downloadedBy: req.user.email },
                    });
                }
            });
        } catch (error) {
            logger.error(`Failed to download report: ${error.message}`, {
                traceId: req.traceId,
                route: 'reports',
                service: 'api',
                status: error.status || 500,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: error.message, stack: error.stack },
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to download report' });
        }
    }

    static async listSchedules(req, res) {
        try {
            const schedules = await ReportSchedule.findAll({
                attributes: ['scheduleID', 'reportType', 'format', 'cronExpression', 'createdBy', 'createdAt'],
                include: [
                    {
                        model: User,
                        attributes: ['userID', 'firstname', 'lastname'],
                        as: 'Creator',
                    },
                ],
            });
            return res.status(200).json(schedules);
        } catch (error) {
            logger.error(`Failed to list report schedules: ${error.message}`, {
                traceId: req.traceId,
                route: 'reports',
                service: 'api',
                status: error.status || 500,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: error.message, stack: error.stack },
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to list report schedules' });
        }
    }

    static async listGeneratedReports(req, res) {
        try {
            const generatedReports = await GeneratedReport.findAll({
                attributes: ['generatedReportID', 'reportType', 'format', 'filePath', 'generatedAt', 'generatedBy', 'scheduleID'],
                include: [
                    {
                        model: User,
                        attributes: ['userID', 'firstname', 'lastname'],
                        as: 'Generator',
                    },
                    {
                        model: ReportSchedule,
                        attributes: ['scheduleID', 'reportType', 'format', 'cronExpression'],
                        as: 'Schedule',
                    },
                ],
                order: [['generatedAt', 'DESC']],
            });
            return res.status(200).json(generatedReports);
        } catch (error) {
            logger.error(`Failed to list generated reports: ${error.message}`, {
                traceId: req.traceId,
                route: 'reports',
                service: 'api',
                status: error.status || 500,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: error.message, stack: error.stack },
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to list generated reports' });
        }
    }

    static async deleteSchedule(req, res) {
        try {
            const { scheduleID } = req.params;
            const schedule = await ReportSchedule.findByPk(scheduleID);
            if (!schedule) {
                return res.status(404).json({ error: 'Schedule not found' });
            }
            await schedule.destroy();
            return res.status(200).json({ message: 'Schedule deleted successfully' });
        } catch (error) {
            logger.error(`Failed to delete report schedule: ${error.message}`, {
                traceId: req.traceId,
                route: 'reports',
                service: 'api',
                status: error.status || 500,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: req.user.userID,
                metadata: { error: error.message, stack: error.stack },
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to delete report schedule' });
        }
    }
}

module.exports = ReportController;