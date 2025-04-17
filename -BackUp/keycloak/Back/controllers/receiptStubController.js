const ReceiptStubService = require('../services/receiptStubService');
const logger = require('../utils/logger');

class ReceiptStubController {
    static async collectStub(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Collect stub failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const result = await ReceiptStubService.collectStub(bookID, req.user.userID);
            logger.info(`Initiated stub collection for book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Collect stub error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to initiate stub collection' });
        }
    }

    static async validateStubCollection(req, res) {
        try {
            const { bookID } = req.params;
            const { otpCode } = req.body;
            if (!bookID || !otpCode) {
                logger.warn(`Validate stub collection failed: Missing bookID or otpCode, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book ID and OTP code are required' });
            }
            const result = await ReceiptStubService.validateStubCollection(bookID, req.user.userID, otpCode);
            logger.info(`Validated stub collection for book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Validate stub collection error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to validate stub collection' });
        }
    }

    static async archiveStub(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Archive stub failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const result = await ReceiptStubService.archiveStub(bookID, req.user.userID);
            logger.info(`Archived stub for book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Archive stub error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to archive stub' });
        }
    }
}

module.exports = ReceiptStubController;