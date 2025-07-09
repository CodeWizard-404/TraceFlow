const ReceiptStubService = require('../services/receiptStubService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing receipt stub operations with structured logging.
 */
class ReceiptStubController {
    /**
     * Initiate stub collection for a receipt book.
     * @param {Object} req - Express request object with bookID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async collectStub(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn('Collect stub failed: Missing bookID', {
                    route: 'receipt-stubs/collect',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const result = await ReceiptStubService.collectStub([bookID], actorID);
            await NotificationService.triggerNotification({
                event: 'receipt_stub:collection_initiated',
                data: { bookID },
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
                metadata: { bookID }
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
     * Validate stub collection with OTP.
     * @param {Object} req - Express request object with bookID in params and otpCode in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async validateStubCollection(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookID } = req.params;
            const { otpCode } = req.body;
            if (!bookID || !otpCode) {
                logger.warn('Validate stub collection failed: Missing bookID or otpCode', {
                    route: 'receipt-stubs/validate',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Book ID and OTP code are required' });
            }
            const result = await ReceiptStubService.validateStubCollection([bookID], actorID, otpCode);
            await NotificationService.triggerNotification({
                event: 'receipt_stub:collection_validated',
                data: { bookID },
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
                metadata: { bookID }
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
     * Archive a stub for a receipt book.
     * @param {Object} req - Express request object with bookID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async archiveStub(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn('Archive stub failed: Missing bookID', {
                    route: 'receipt-stubs/archive',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const result = await ReceiptStubService.archiveStub(bookID, actorID);
            await NotificationService.triggerNotification({
                event: 'receipt_stub:archived',
                data: { bookID },
                metadata: { archivedBy: req.user.email }
            });
            logger.info('Successfully archived stub', {
                route: 'receipt-stubs/archive',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookID }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to archive stub', {
                route: 'receipt-stubs/archive',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to archive stub' });
        }
    }
}

module.exports = ReceiptStubController;