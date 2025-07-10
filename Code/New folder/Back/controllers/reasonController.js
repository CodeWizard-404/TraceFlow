const ReasonService = require('../services/reasonService');
const NotificationService = require('../services/notificationService');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');

/**
 * Controller for managing reason operations with structured logging and notifications.
 */
class ReasonController {
    // --- Reason Retrieval Methods ---

    static async getAllReasons(req, res) {
        try {
            const cacheInstance = await cache();
            const reasons = await cacheInstance.getOrSet('reasons:all', async () => {
                return await ReasonService.getAllReasons();
            }, 'api');

            logRequest({
                req,
                res: reasons,
                status: 200,
                message: `Retrieved ${reasons.length} reasons`,
                level: 'info',
                metadata: { reasonCount: reasons.length },
                service: 'reason',
                defaultRoute: 'reasons'
            });

            return res.status(200).json(reasons);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch reasons: ${error.message}`,
                level: 'error',
                service: 'reason',
                defaultRoute: 'reasons'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve reasons' });
        }
    }

    static async getReasonByID(req, res) {
        try {
            const { id: reasonID } = req.params;
            if (!reasonID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Reason ID is required',
                    level: 'info',
                    service: 'reason',
                    defaultRoute: 'reasons'
                });
                return res.status(400).json({ error: 'Reason ID is required' });
            }

            const cacheInstance = await cache();
            const reason = await cacheInstance.getOrSet(`reason:${reasonID}`, async () => {
                return await ReasonService.getItemById(reasonID);
            }, 'api');

            logRequest({
                req,
                res: reason,
                status: 200,
                message: `Retrieved reason ${reasonID}`,
                level: 'info',
                metadata: { reasonID },
                service: 'reason',
                defaultRoute: 'reasons'
            });

            return res.status(200).json(reason);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to fetch reason: ${error.message}`,
                level: 'error',
                service: 'reason',
                defaultRoute: 'reasons'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Reason not found' });
        }
    }

    static async getReasonsByVisitID(req, res) {
        try {
            const { id: visitID } = req.params;
            if (!visitID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Visit ID is required',
                    level: 'info',
                    service: 'reason',
                    defaultRoute: 'reasons'
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }

            const cacheInstance = await cache();
            const reasons = await cacheInstance.getOrSet(`reasons:visit:${visitID}`, async () => {
                return await ReasonService.getReasonsByVisitId(visitID);
            }, 'api');

            logRequest({
                req,
                res: reasons,
                status: 200,
                message: `Retrieved ${reasons.length} reasons for visit ${visitID}`,
                level: 'info',
                metadata: { visitID, reasonCount: reasons.length },
                service: 'reason',
                defaultRoute: 'reasons'
            });

            return res.status(200).json(reasons);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to fetch reasons by visit: ${error.message}`,
                level: 'error',
                service: 'reason',
                defaultRoute: 'reasons'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Reasons not found for visit' });
        }
    }

    // --- Reason Modification Methods ---

    static async createReason(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { text } = req.body;
            if (!text) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Reason text is required',
                    level: 'info',
                    service: 'reason',
                    defaultRoute: 'reasons'
                });
                return res.status(400).json({ error: 'Reason text is required' });
            }

            const reason = await ReasonService.createItem(text, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('reasons');
            await cacheInstance.invalidate(`reason:${reason.reasonID}`);
            await redis.set('reasons:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'reasons');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'reason:created',
                data: { reasonID: reason.reasonID, text },
                metadata: { createdBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'reason',
                customMessage: `Reason item created`,
                requestID,
            });

            logRequest({
                req,
                res: reason,
                status: 201,
                message: `Created reason ${reason.reasonID}`,
                level: 'info',
                metadata: { reasonID: reason.reasonID, text, requestID },
                service: 'reason',
                defaultRoute: 'reasons'
            });

            await transaction.commit();
            return res.status(201).json(reason);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to create reason: ${error.message}`,
                level: 'error',
                service: 'reason',
                defaultRoute: 'reasons'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to create reason' });
        }
    }

    static async updateReason(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { id: reasonID } = req.params;
            const { text } = req.body;
            if (!reasonID || !text) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Reason ID and text are required',
                    level: 'info',
                    service: 'reason',
                    defaultRoute: 'reasons'
                });
                return res.status(400).json({ error: 'Reason ID and text are required' });
            }

            const reason = await ReasonService.updateItem(reasonID, text, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('reasons');
            await cacheInstance.invalidate(`reason:${reasonID}`);
            await redis.set('reasons:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'reasons');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'reason:updated',
                data: { reasonID, text },
                metadata: { updatedBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'reason',
                customMessage: `Reason item updated`,
                requestID,
            });

            logRequest({
                req,
                res: reason,
                status: 200,
                message: `Updated reason ${reasonID}`,
                level: 'info',
                metadata: { reasonID, text, requestID },
                service: 'reason',
                defaultRoute: 'reasons'
            });

            await transaction.commit();
            return res.status(200).json(reason);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to update reason: ${error.message}`,
                level: 'error',
                service: 'reason',
                defaultRoute: 'reasons'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Failed to update reason' });
        }
    }

    static async deleteReason(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { id: reasonID } = req.params;
            if (!reasonID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Reason ID is required',
                    level: 'info',
                    service: 'reason',
                    defaultRoute: 'reasons'
                });
                return res.status(400).json({ error: 'Reason ID is required' });
            }


            await ReasonService.deleteItem(reasonID, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('reasons');
            await cacheInstance.invalidate(`reason:${reasonID}`);
            await redis.set('reasons:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'reasons');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'reason:deleted',
                data: { reasonID },
                metadata: { deletedBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'reason',
                customMessage: `Reason item deleted`,
                requestID,
            });

            logRequest({
                req,
                status: 204,
                message: `Deleted reason ${reasonID}`,
                level: 'info',
                metadata: { reasonID, requestID },
                service: 'reason',
                defaultRoute: 'reasons'
            });

            await transaction.commit();
            return res.status(204).send();
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to delete reason: ${error.message}`,
                level: 'error',
                service: 'reason',
                defaultRoute: 'reasons'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Failed to delete reason' });
        }
    }
}
module.exports = ReasonController;