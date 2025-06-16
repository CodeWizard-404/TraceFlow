const ReceiptStubService = require('../services/receiptStubService');
const NotificationService = require('../services/notificationService');
const { ReceiptBook } = require('../models');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');

/**
 * Controller for managing receipt stub operations with structured logging and notifications.
 */
class ReceiptStubController {
    /**
     * Initiate stub collection for multiple receipt books.
     * @param {Object} req - Express request object with bookIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async collectStub(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { bookIDs } = req.body;
            if (!Array.isArray(bookIDs) || bookIDs.length === 0) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'bookIDs must be a non-empty array',
                    level: 'info',
                    service: 'receipt_stub',
                    defaultRoute: 'receipt-stubs'
                });
                return res.status(400).json({ error: 'bookIDs must be a non-empty array' });
            }

            const result = await ReceiptStubService.collectStub(bookIDs, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_stubs');
            for (const bookID of bookIDs) {
                await cacheInstance.invalidate(`receipt_book:${bookID}`);
                await RedisUtils.publishEvent('cache:invalidate', `receipt_book:${bookID}`);
            }
            await redis.set('receipt_stubs:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_stubs');

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Initiated stub collection for ${bookIDs.length} books`,
                level: 'info',
                metadata: { bookIDs, bookCount: bookIDs.length },
                service: 'receipt_stub',
                defaultRoute: 'receipt-stubs'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to initiate stub collection: ${error.message}`,
                level: 'error',
                service: 'receipt_stub',
                defaultRoute: 'receipt-stubs'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to initiate stub collection' });
        }
    }

    /**
     * Validate stub collection with OTP for multiple receipt books.
     * @param {Object} req - Express request object with bookIDs and otpCode in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async validateStubCollection(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { bookIDs, otpCode } = req.body;
            if (!Array.isArray(bookIDs) || bookIDs.length === 0 || !otpCode) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'bookIDs must be a non-empty array and otpCode is required',
                    level: 'info',
                    service: 'receipt_stub',
                    defaultRoute: 'receipt-stubs'
                });
                return res.status(400).json({ error: 'bookIDs must be a non-empty array and otpCode is required' });
            }

            const result = await ReceiptStubService.validateStubCollection(bookIDs, req.user.userID, otpCode, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_stubs');
            for (const bookID of bookIDs) {
                await cacheInstance.invalidate(`receipt_book:${bookID}`);
                await RedisUtils.publishEvent('cache:invalidate', `receipt_book:${bookID}`);
            }
            await redis.set('receipt_stubs:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_stubs');

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Validated stub collection for ${bookIDs.length} books`,
                level: 'info',
                metadata: { bookIDs, bookCount: bookIDs.length },
                service: 'receipt_stub',
                defaultRoute: 'receipt-stubs'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to validate stub collection: ${error.message}`,
                level: 'error',
                service: 'receipt_stub',
                defaultRoute: 'receipt-stubs'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to validate stub collection' });
        }
    }

    /**
     * Archive stubs for multiple receipt books.
     * @param {Object} req - Express request object with bookIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async archiveStub(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { bookIDs } = req.body;
            if (!Array.isArray(bookIDs) || bookIDs.length === 0) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'bookIDs must be a non-empty array',
                    level: 'info',
                    service: 'receipt_stub',
                    defaultRoute: 'receipt-stubs'
                });
                return res.status(400).json({ error: 'bookIDs must be a non-empty array' });
            }

            // Fetch current holders for notification
            const books = await ReceiptBook.findAll({
                where: { bookID: bookIDs },
                attributes: ['bookID', 'currentHolderID'],
                transaction
            });

            const result = await ReceiptStubService.archiveStub(bookIDs, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_stubs');
            for (const bookID of bookIDs) {
                await cacheInstance.invalidate(`receipt_book:${bookID}`);
                await RedisUtils.publishEvent('cache:invalidate', `receipt_book:${bookID}`);
            }
            await redis.set('receipt_stubs:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_stubs');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'receipt_stub:archived',
                data: { bookIDs },
                metadata: { archivedBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'receipt_stub',
                customMessage: `Archived stubs for ${bookIDs.length} receipt books`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Archived stubs for ${bookIDs.length} books`,
                level: 'info',
                metadata: { bookIDs, bookCount: bookIDs.length, requestID },
                service: 'receipt_stub',
                defaultRoute: 'receipt-stubs'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to archive stubs: ${error.message}`,
                level: 'error',
                service: 'receipt_stub',
                defaultRoute: 'receipt-stubs'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to archive stubs' });
        }
    }
}

module.exports = ReceiptStubController;