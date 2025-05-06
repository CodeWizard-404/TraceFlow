const ReceiptStubService = require('../services/receiptStubService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing receipt stub operations.
 */
class ReceiptStubController {
    /**
     * Initiate stub collection for a receipt book.
     * @param {Object} req - Express request object with bookID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async collectStub(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Collect stub failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const result = await ReceiptStubService.collectStub(bookID, req.user.userID);
            // Notify user and manager of stub collection initiation
            await NotificationService.triggerNotification({
                event: 'receipt_stub:collection_initiated',
                data: { bookID },
                metadata: { initiatedBy: req.user.email },
            });
            logger.info(`Initiated stub collection for book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Collect stub error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { bookID } = req.params;
            const { otpCode } = req.body;
            if (!bookID || !otpCode) {
                logger.warn(`Validate stub collection failed: Missing bookID or otpCode, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book ID and OTP code are required' });
            }
            const result = await ReceiptStubService.validateStubCollection(bookID, req.user.userID, otpCode);
            // Notify user and manager of stub collection validation
            await NotificationService.triggerNotification({
                event: 'receipt_stub:collection_validated',
                data: { bookID },
                metadata: { validatedBy: req.user.email },
            });
            logger.info(`Validated stub collection for book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Validate stub collection error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Archive stub failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const result = await ReceiptStubService.archiveStub(bookID, req.user.userID);
            // Notify user and manager of stub archiving
            await NotificationService.triggerNotification({
                event: 'receipt_stub:archived',
                data: { bookID },
                metadata: { archivedBy: req.user.email },
            });
            logger.info(`Archived stub for book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Archive stub error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to archive stub' });
        }
    }
}

module.exports = ReceiptStubController;