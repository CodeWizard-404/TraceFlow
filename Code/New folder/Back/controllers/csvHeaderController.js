const CsvHeaderService = require('../services/csvHeaderService');
const NotificationService = require('../services/notificationService');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');
const { User } = require('../models');


/**
 * Controller for managing CSV header-related operations.
 */
class CsvHeaderController {
    static async getHeaders(req, res) {
        try {
            const { csvType } = req.query;
            if (!csvType) {
                logRequest({
                    req,
                    status: 400,
                    message: 'csvType is required',
                    level: 'info',
                    service: 'csv-header',
                    defaultRoute: 'csv-headers'
                });
                return res.status(400).json({ error: 'csvType is required' });
            }

            const cacheInstance = await cache();
            const headers = await cacheInstance.getOrSet(`csv-headers:${csvType}`, async () => {
                return await CsvHeaderService.getHeaders(csvType);
            }, 'api');

            logRequest({
                req,
                res: { headers },
                status: 200,
                message: `Retrieved ${headers.length} CSV headers for type ${csvType}`,
                level: 'info',
                metadata: { csvType, headerCount: headers.length },
                service: 'csv-header',
                defaultRoute: 'csv-headers'
            });

            return res.status(200).json({ headers });
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to fetch CSV headers: ${error.message}`,
                level: 'error',
                service: 'csv-header',
                defaultRoute: 'csv-headers'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async updateHeaders(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { csvType, headers } = req.body;
            if (!csvType || !headers || !Array.isArray(headers)) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'csvType and headers array are required',
                    level: 'info',
                    service: 'csv-header',
                    defaultRoute: 'csv-headers'
                });
                return res.status(400).json({ error: 'csvType and headers array are required' });
            }

            const result = await CsvHeaderService.updateHeaders(csvType, headers, req.user?.userID || 'unknown', { transaction });
            const user = await User.findByPk(req.user?.userID);
            if (!result.success) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: result.message,
                    level: 'info',
                    service: 'csv-header',
                    defaultRoute: 'csv-headers'
                });
                return res.status(400).json({ error: result.message });
            }

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('csv-headers');
            await cacheInstance.invalidate(`csv-headers:${csvType}`);
            await redis.set('csv-headers:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'csv-headers');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'csv-header:updated',
                data: { csvType, headerCount: headers.length },
                metadata: { updatedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: req.user?.userID || 'unknown',
                type: 'csv-header',
                customMessage: `CSV headers updated for type ${csvType} by user ${user.firstname} ${user.lastname}`,
                requestID,
            });

            logRequest({
                req,
                res: { message: result.message },
                status: 200,
                message: `Updated ${headers.length} CSV headers for type ${csvType}`,
                level: 'info',
                metadata: { csvType, headerCount: headers.length, requestID },
                service: 'csv-header',
                defaultRoute: 'csv-headers'
            });

            await transaction.commit();
            return res.status(200).json({ message: result.message });
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: 500,
                message: `Failed to update CSV headers: ${error.message}`,
                level: 'error',
                service: 'csv-header',
                defaultRoute: 'csv-headers'
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = CsvHeaderController;