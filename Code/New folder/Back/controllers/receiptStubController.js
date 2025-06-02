const ReceiptStubService = require('../services/receiptStubService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing receipt stub operations with structured logging.
 */
class ReceiptStubController {
    /**
     * Initiate stub collection for multiple receipt books.
     * @param {Object} req - Express request object with bookIDs in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async collectStub(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookIDs } = req.body;
            if (!Array.isArray(bookIDs) || bookIDs.length === 0) {
                logger.warn('Collect stub failed: Invalid or missing bookIDs', {
                    route: 'receipt-stubs/collect',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'bookIDs must be a non-empty array' });
            }
            const result = await ReceiptStubService.collectStub(bookIDs, actorID);
            await NotificationService.triggerNotification({
                event: 'receipt_stub:collection_initiated',
                data: { bookIDs },
                metadata: { initiatedBy: req.user.email }
            });
            logger.info('Successfully initiated stub collection', {
                route: 'receipt-stubs/collect',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookIDs }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to initiate stub collection', {
                route: 'receipt-stubs/collect',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookIDs, otpCode } = req.body;
            if (!Array.isArray(bookIDs) || bookIDs.length === 0 || !otpCode) {
                logger.warn('Validate stub collection failed: Missing or invalid bookIDs or otpCode', {
                    route: 'receipt-stubs/validate',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'bookIDs must be a non-empty array and otpCode is required' });
            }
            const result = await ReceiptStubService.validateStubCollection(bookIDs, actorID, otpCode);
            await NotificationService.triggerNotification({
                event: 'receipt_stub:collection_validated',
                data: { bookIDs },
                metadata: { validatedBy: req.user.email }
            });
            logger.info('Successfully validated stub collection', {
                route: 'receipt-stubs/validate',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookIDs }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to validate stub collection', {
                route: 'receipt-stubs/validate',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookIDs } = req.body;
            if (!Array.isArray(bookIDs) || bookIDs.length === 0) {
                logger.warn('Archive stub failed: Invalid or missing bookIDs', {
                    route: 'receipt-stubs/archive',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'bookIDs must be a non-empty array' });
            }

            // Call archiveStub with the full array
            const result = await ReceiptStubService.archiveStub(bookIDs, actorID);
            await NotificationService.triggerNotification({
                event: 'receipt_stub:archived',
                data: { bookIDs },
                metadata: { archivedBy: req.user.email }
            });
            logger.info('Successfully archived stubs', {
                route: 'receipt-stubs/archive',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookIDs }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to archive stubs', {
                route: 'receipt-stubs/archive',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message, bookIDs: req.body.bookIDs }
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to archive stubs' });
        }
    }
}

module.exports = ReceiptStubController;