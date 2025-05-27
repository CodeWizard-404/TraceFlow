const { Log } = require('../models'); // Import the Log model
const SystemService = require('../services/SystemService');
const logger = require('../utils/logger');

// Instantiate SystemService with the Log model
const systemService = new SystemService(Log);

class SystemController {
    /**
     * Fetch logs with pagination and filters
     */
    static async getLogs(req, res) {
        try {
            const {
                page,
                pageSize,
                level,
                route,
                service,
                status,
                method,
                userId,
                traceId,
                startDate,
                endDate,
                search,
                sortBy,
                sortOrder,
            } = req.query;

            const logs = await systemService.getLogs({
                page: page ? parseInt(page) : undefined,
                pageSize: pageSize ? parseInt(pageSize) : undefined,
                level,
                route,
                service,
                status: status ? parseInt(status) : undefined,
                method,
                userId,
                traceId,
                startDate,
                endDate,
                search,
                sortBy,
                sortOrder,
            });

            logger.info(`Fetched logs by user ${req.user.userID}`, {
                page,
                pageSize,
                level,
                route,
                service,
                status,
                method,
                userId,
                traceId,
                search,
                ip: req.ip,
            });

            return res.status(200).json(logs);
        } catch (error) {
            logger.error(`Get logs error: ${error.message}`, {
                user: req.user.userID,
                ip: req.ip,
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch logs' });
        }
    }

    // ... other methods remain unchanged, but update all calls to SystemService to use systemService
    static async getLogsByCategory(req, res) {
        try {
            const { category } = req.params;
            const { startDate, endDate, level, route, service } = req.query;

            const results = await systemService.getLogsByCategory(category, {
                startDate,
                endDate,
                level,
                route,
                service,
            });

            logger.info(`Fetched logs by category ${category} by user ${req.user.userID}`, {
                category,
                startDate,
                endDate,
                level,
                route,
                service,
                ip: req.ip,
            });

            return res.status(200).json(results);
        } catch (error) {
            logger.error(`Get logs by category error: ${error.message}`, {
                user: req.user.userID,
                ip: req.ip,
                category: req.params.category,
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch logs by category' });
        }
    }

    static async deleteLogs(req, res) {
        try {
            const { level, route, service, status, method, userId, traceId, startDate, endDate } = req.body;

            const deletedCount = await systemService.deleteLogs({
                level,
                route,
                service,
                status: status ? parseInt(status) : undefined,
                method,
                userId,
                traceId,
                startDate,
                endDate,
            });

            logger.info(`Deleted ${deletedCount} logs by user ${req.user.userID}`, {
                level,
                route,
                service,
                status,
                method,
                userId,
                traceId,
                startDate,
                endDate,
                ip: req.ip,
            });

            return res.status(200).json({ deletedCount });
        } catch (error) {
            logger.error(`Delete logs error: ${error.message}`, {
                user: req.user.userID,
                ip: req.ip,
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to delete logs' });
        }
    }

    static async archiveLogs(req, res) {
        try {
            const { retentionDays } = req.body;
            const deletedCount = await systemService.archiveLogs(retentionDays);

            logger.info(`Archived ${deletedCount} logs by user ${req.user.userID}`, {
                retentionDays,
                ip: req.ip,
            });

            return res.status(200).json({ deletedCount });
        } catch (error) {
            logger.error(`Archive logs error: ${error.message}`, {
                user: req.user.userID,
                ip: req.ip,
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to archive logs' });
        }
    }

    static async getLogStatistics(req, res) {
        try {
            const { startDate, endDate, route, service, level } = req.query;

            const stats = await systemService.getLogStatistics({
                startDate,
                endDate,
                route,
                service,
                level,
            });

            logger.info(`Fetched log statistics by user ${req.user.userID}`, {
                startDate,
                endDate,
                route,
                service,
                level,
                ip: req.ip,
            });

            return res.status(200).json(stats);
        } catch (error) {
            logger.error(`Get log statistics error: ${error.message}`, {
                user: req.user.userID,
                ip: req.ip,
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch log statistics' });
        }
    }

    static async exportLogs(req, res) {
        try {
            const { level, route, service, status, startDate, endDate } = req.query;

            const logs = await systemService.exportLogs({
                level,
                route,
                service,
                status: status ? parseInt(status) : undefined,
                startDate,
                endDate,
            });

            logger.info(`Exported ${logs.length} logs by user ${req.user.userID}`, {
                level,
                route,
                service,
                status,
                startDate,
                endDate,
                ip: req.ip,
            });

            return res.status(200).json(logs);
        } catch (error) {
            logger.error(`Export logs error: ${error.message}`, {
                user: req.user.userID,
                ip: req.ip,
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to export logs' });
        }
    }

    static async clearAllLogs(req, res) {
        try {
            const deletedCount = await systemService.clearAllLogs();

            logger.info(`Cleared ${deletedCount} logs by user ${req.user.userID}`, {
                ip: req.ip,
            });

            return res.status(200).json({ deletedCount });
        } catch (error) {
            logger.error(`Clear all logs error: ${error.message}`, {
                user: req.user.userID,
                ip: req.ip,
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to clear all logs' });
        }
    }

    static async getUniqueValues(req, res) {
        try {
            const { field } = req.params;

            const values = await systemService.getUniqueValues(field);

            logger.info(`Fetched unique values for ${field} by user ${req.user.userID}`, {
                field,
                count: values.length,
                ip: req.ip,
            });

            return res.status(200).json(values);
        } catch (error) {
            logger.error(`Get unique values error: ${error.message}`, {
                user: req.user.userID,
                ip: req.ip,
                field: req.params.field,
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch unique values' });
        }
    }

    static async getLoggerHealth(req, res) {
        try {
            const health = logger.health();

            logger.info(`Fetched logger health by user ${req.user.userID}`, {
                ip: req.ip,
            });

            return res.status(200).json(health);
        } catch (error) {
            logger.error(`Get logger health error: ${error.message}`, {
                user: req.user.userID,
                ip: req.ip,
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch logger health' });
        }
    }

    static async getLoggerMetrics(req, res) {
        try {
            const metrics = await logger.getMetrics();

            logger.info(`Fetched logger metrics by user ${req.user.userID}`, {
                ip: req.ip,
            });

            res.set('Content-Type', 'text/plain');
            return res.status(200).send(metrics);
        } catch (error) {
            logger.error(`Get logger metrics error: ${error.message}`, {
                user: req.user.userID,
                ip: req.ip,
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch logger metrics' });
        }
    }
}

module.exports = SystemController;