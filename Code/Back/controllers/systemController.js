const { Log } = require('../models');
const SystemService = require('../services/SystemService');
const NotificationService = require('../services/notificationService');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');
const logger = require('../utils/logger');

const systemService = new SystemService(Log);

class SystemController {
    static async getLogs(req, res) {
        try {
            const {
                page, pageSize, level, route, service, status, method, userId, traceId,
                startDate, endDate, search, sortBy, sortOrder, includeDeleted
            } = req.query;
            const actorID = req.user?.userID || 'unknown';

            const cacheKey = `logs:${JSON.stringify({ page, pageSize, level, route, service, status, method, userId, traceId, startDate, endDate, search, sortBy, sortOrder, includeDeleted })}`;
            const cacheInstance = await cache();
            const logs = await cacheInstance.getOrSet(cacheKey, async () => {
                return await systemService.getLogs({
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
                    includeDeleted: includeDeleted === 'true',
                });
            }, 'api');

            logRequest({
                req,
                res: logs,
                status: 200,
                message: `Retrieved logs`,
                level: 'info',
                metadata: { page, pageSize, level, route, service, status, count: logs.length || logs.count },
                service: 'system',
                defaultRoute: 'logs'
            });

            return res.status(200).json(logs);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch logs: ${error.message}`,
                level: 'error',
                service: 'system',
                defaultRoute: 'logs'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch logs' });
        }
    }

    static async getLogsByCategory(req, res) {
        try {
            const { category } = req.params;
            const { startDate, endDate, level, route, service } = req.query;
            const actorID = req.user?.userID || 'unknown';

            const cacheKey = `logs:category:${category}:${JSON.stringify({ startDate, endDate, level, route, service })}`;
            const cacheInstance = await cache();
            const results = await cacheInstance.getOrSet(cacheKey, async () => {
                return await systemService.getLogsByCategory(category, {
                    startDate, endDate, level, route, service
                });
            }, 'api');

            logRequest({
                req,
                res: results,
                status: 200,
                message: `Retrieved logs for category ${category}`,
                level: 'info',
                metadata: { category, startDate, endDate, level, route, service, count: results.length },
                service: 'system',
                defaultRoute: 'logs'
            });

            return res.status(200).json(results);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch logs by category: ${error.message}`,
                level: 'error',
                service: 'system',
                defaultRoute: 'logs'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch logs by category' });
        }
    }

    static async deleteLogs(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { level, route, service, status, method, userId, traceId, startDate, endDate, force } = req.body;
            const actorID = req.user?.userID || 'unknown';

            const deletedCount = await systemService.deleteLogs({
                level, route, service, status: status ? parseInt(status) : undefined, method,
                userId, traceId, startDate, endDate, force: force === true
            }, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('logs');
            await redis.set('logs:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'logs');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'logs:deleted',
                data: { deletedCount: deletedCount.count || deletedCount },
                metadata: { deletedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'system',
                customMessage: `${deletedCount.count || deletedCount} logs deleted by user ${actorID}`,
                requestID,
            });

            logRequest({
                req,
                res: deletedCount,
                status: 200,
                message: `Deleted ${JSON.stringify(deletedCount)} logs`,
                level: 'info',
                metadata: { level, route, service, status, method, userId, traceId, startDate, endDate, force, requestID },
                service: 'system',
                defaultRoute: 'logs'
            });

            await transaction.commit();
            return res.status(200).json(deletedCount);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to delete logs: ${error.message}`,
                level: 'error',
                service: 'system',
                defaultRoute: 'logs'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to delete logs' });
        }
    }

    static async archiveLogs(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { retentionDays, force } = req.body;
            const actorID = req.user?.userID || 'unknown';

            const deletedCount = await systemService.archiveLogs(retentionDays, force === true, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('logs');
            await redis.set('logs:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'logs');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'logs:archived',
                data: { deletedCount: deletedCount.count || deletedCount, retentionDays },
                metadata: { archivedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'system',
                customMessage: `${deletedCount.count || deletedCount} logs archived by user ${actorID}`,
                requestID,
            });

            logRequest({
                req,
                res: deletedCount,
                status: 200,
                message: `Archived ${JSON.stringify(deletedCount)} logs`,
                level: 'info',
                metadata: { retentionDays, force, requestID },
                service: 'system',
                defaultRoute: 'logs'
            });

            await transaction.commit();
            return res.status(200).json(deletedCount);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to archive logs: ${error.message}`,
                level: 'error',
                service: 'system',
                defaultRoute: 'logs'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to archive logs' });
        }
    }

    static async getLogStatistics(req, res) {
        try {
            const { startDate, endDate, route, service, level } = req.query;
            const actorID = req.user?.userID || 'unknown';

            const cacheKey = `logs:stats:${JSON.stringify({ startDate, endDate, route, service, level })}`;
            const cacheInstance = await cache();
            const stats = await cacheInstance.getOrSet(cacheKey, async () => {
                return await systemService.getLogStatistics({ startDate, endDate, route, service, level });
            }, 'api');

            logRequest({
                req,
                res: stats,
                status: 200,
                message: `Retrieved log statistics`,
                level: 'info',
                metadata: { startDate, endDate, route, service, level },
                service: 'system',
                defaultRoute: 'logs'
            });

            return res.status(200).json(stats);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch log statistics: ${error.message}`,
                level: 'error',
                service: 'system',
                defaultRoute: 'logs'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch log statistics' });
        }
    }

    static async exportLogs(req, res) {
        try {
            const { level, route, service, status, startDate, endDate } = req.query;
            const actorID = req.user?.userID || 'unknown';

            const logs = await systemService.exportLogs({
                level, route, service, status: status ? parseInt(status) : undefined, startDate, endDate
            });

            logRequest({
                req,
                res: logs,
                status: 200,
                message: `Exported ${logs.length} logs`,
                level: 'info',
                metadata: { level, route, service, status, startDate, endDate, count: logs.length },
                service: 'system',
                defaultRoute: 'logs'
            });

            return res.status(200).json(logs);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to export logs: ${error.message}`,
                level: 'error',
                service: 'system',
                defaultRoute: 'logs'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to export logs' });
        }
    }

    static async clearAllLogs(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const actorID = req.user?.userID || 'unknown';

            const deletedCount = await systemService.clearAllLogs({ transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('logs');
            await redis.set('logs:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'logs');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'logs:cleared',
                data: { deletedCount: deletedCount.count || deletedCount },
                metadata: { clearedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'system',
                customMessage: `All logs cleared by user ${actorID}`,
                requestID,
            });

            logRequest({
                req,
                res: deletedCount,
                status: 200,
                message: `Cleared ${JSON.stringify(deletedCount)} logs`,
                level: 'info',
                metadata: { requestID },
                service: 'system',
                defaultRoute: 'logs'
            });

            await transaction.commit();
            return res.status(200).json(deletedCount);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to clear all logs: ${error.message}`,
                level: 'error',
                service: 'system',
                defaultRoute: 'logs'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to clear all logs' });
        }
    }

    static async getUniqueValues(req, res) {
        try {
            const { field } = req.params;
            const actorID = req.user?.userID || 'unknown';

            const cacheKey = `logs:unique:${field}`;
            const cacheInstance = await cache();
            const values = await cacheInstance.getOrSet(cacheKey, async () => {
                return await systemService.getUniqueValues(field);
            }, 'api');

            logRequest({
                req,
                res: values,
                status: 200,
                message: `Retrieved unique values for ${field}`,
                level: 'info',
                metadata: { field, count: values.length },
                service: 'system',
                defaultRoute: 'logs'
            });

            return res.status(200).json(values);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch unique values: ${error.message}`,
                level: 'error',
                service: 'system',
                defaultRoute: 'logs'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch unique values' });
        }
    }

    static async getLoggerHealth(req, res) {
        try {
            const health = logger.health();

            logRequest({
                req,
                res: health,
                status: 200,
                message: `Retrieved logger health`,
                level: 'info',
                metadata: {},
                service: 'system',
                defaultRoute: 'logs'
            });

            return res.status(200).json(health);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch logger health: ${error.message}`,
                level: 'error',
                service: 'system',
                defaultRoute: 'logs'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch logger health' });
        }
    }

    static async getLoggerMetrics(req, res) {
        try {
            const actorID = req.user?.userID || 'unknown';
            const metrics = await systemService.getLoggerMetrics();

            logRequest({
                req,
                res: metrics,
                status: 200,
                message: `Retrieved logger metrics`,
                level: 'info',
                metadata: {},
                service: 'system',
                defaultRoute: 'logs'
            });

            res.set('Content-Type', 'text/plain');
            return res.status(200).send(metrics);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch logger metrics: ${error.message}`,
                level: 'error',
                service: 'system',
                defaultRoute: 'logs'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch logger metrics' });
        }
    }
}

module.exports = SystemController;