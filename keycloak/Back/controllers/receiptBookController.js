const ReceiptBookService = require('../services/receiptBookService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing receipt book operations.
 */
class ReceiptBookController {
    // --- Receipt Book Retrieval Methods ---

    /**
     * Get all receipt books.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with receipt books or error.
     */
    static async getAllReceiptBooks(req, res) {
        try {
            const startTime = Date.now();
            const receiptBooks = await ReceiptBookService.getAllReceiptBooks();
            const responseBooks = receiptBooks.map(book => ({
                ...book,
                qrCode: book.qrCode ? Buffer.from(book.qrCode).toString('base64') : null,
            }));
            logger.info(`Fetched ${responseBooks.length} receipt books by user ${req.user.userID} in ${Date.now() - startTime}ms, IP: ${req.ip}`);
            return res.status(200).json(responseBooks);
        } catch (error) {
            logger.error(`Get all receipt books error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve receipt books' });
        }
    }

    /**
     * Get a receipt book by ID.
     * @param {Object} req - Express request object with bookID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with receipt book or error.
     */
    static async getReceiptBookById(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Get receipt book failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            // Convert Sequelize instance to plain object
            const plainBook = receiptBook.toJSON();
            // Construct response object to avoid circular references
            const responseBook = {
                bookID: plainBook.bookID,
                number: plainBook.number,
                type: plainBook.type,
                status: plainBook.status,
                qrCode: plainBook.qrCode ? Buffer.from(plainBook.qrCode).toString('base64') : null,
                agentID: plainBook.agentID,
                currentHolderID: plainBook.currentHolderID,
                CurrentHolder: plainBook.CurrentHolder || null,
                ReceiptBookTransfers: plainBook.ReceiptBookTransfers || [],
                Agent: plainBook.Agent || null,
                ReceiptStub: plainBook.ReceiptStub || null,
            };
            logger.info(`Fetched receipt book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseBook);
        } catch (error) {
            logger.error(`Get receipt book error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Receipt book not found' });
        }
    }

    /**
     * Get a receipt book by number.
     * @param {Object} req - Express request object with number in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with receipt book or error.
     */
    static async getReceiptBookByNumber(req, res) {
        try {
            const { number } = req.params;
            if (!number) {
                logger.warn(`Get receipt book by number failed: Missing number, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book number is required' });
            }
            const receiptBook = await ReceiptBookService.getReceiptBookByNumber(number);
            const responseBook = {
                ...receiptBook,
                qrCode: receiptBook.qrCode ? Buffer.from(receiptBook.qrCode).toString('base64') : null,
            };
            logger.info(`Fetched receipt book number ${number} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseBook);
        } catch (error) {
            logger.error(`Get receipt book by number error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Receipt book not found' });
        }
    }

    /**
     * Get receipt books by holder.
     * @param {Object} req - Express request object with holderID in params and userType in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with receipt books or error.
     */
    static async getReceiptBooksByHolder(req, res) {
        try {
            const { holderID } = req.params;
            const { userType } = req.body;
            if (!holderID || !userType) {
                logger.warn(`Get receipt books by holder failed: Missing holderID or userType, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Holder ID and user type are required' });
            }
            const receiptBooks = await ReceiptBookService.getReceiptBooksByHolder(holderID, userType);
            const responseBooks = Array.isArray(receiptBooks)
                ? receiptBooks.map(book => ({
                    ...book,
                    qrCode: book.qrCode ? Buffer.from(book.qrCode).toString('base64') : null,
                }))
                : {
                    ...receiptBooks,
                    qrCode: receiptBooks.qrCode ? Buffer.from(receiptBooks.qrCode).toString('base64') : null,
                };
            logger.info(`Fetched receipt books for holder ${holderID} (${userType}) by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseBooks);
        } catch (error) {
            logger.error(`Get receipt books by holder error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Receipt books not found' });
        }
    }

    /**
     * Get transfer history for a receipt book.
     * @param {Object} req - Express request object with bookID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with transfer history or error.
     */
    static async getTransferHistory(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Get transfer history failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const history = await ReceiptBookService.getTransferHistory(bookID);
            logger.info(`Fetched transfer history for book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(history);
        } catch (error) {
            logger.error(`Get transfer history error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Failed to retrieve transfer history' });
        }
    }

    // --- Receipt Book Modification Methods ---

    /**
     * Create a new receipt book.
     * @param {Object} req - Express request object with number and type in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created receipt book or error.
     */
    static async createReceiptBook(req, res) {
        try {
            const { number, type } = req.body;
            if (!number || !type) {
                logger.warn(`Create receipt book failed: Missing number or type, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Number and type are required' });
            }
            const receiptBook = await ReceiptBookService.createReceiptBook(number, type, req.user.userID);
            const responseBook = {
                ...receiptBook,
                qrCode: receiptBook.qrCode ? Buffer.from(receiptBook.qrCode).toString('base64') : null,
            };
            // Notify creator and manager of new receipt book
            await NotificationService.triggerNotification({
                event: 'receipt_book:created',
                data: { bookID: receiptBook.bookID, number, type },
                metadata: { createdBy: req.user.email },
            });
            logger.info(`Receipt book ${number} created by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(responseBook);
        } catch (error) {
            logger.error(`Create receipt book error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to create receipt book' });
        }
    }

    /**
     * Send receipt books to a supplier.
     * @param {Object} req - Express request object with bookIDs and supplierEmail in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async sendToSupplier(req, res) {
        try {
            const { bookIDs, supplierEmail } = req.body;
            if (!Array.isArray(bookIDs) || !supplierEmail) {
                logger.warn(`Send to supplier failed: Missing bookIDs or supplierEmail, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book IDs (array) and supplier email are required' });
            }
            const result = await ReceiptBookService.sendToSupplier(bookIDs, supplierEmail, req.user.userID);
            // Notify supplier and manager of books sent
            await NotificationService.triggerNotification({
                event: 'receipt_book:sent_to_supplier',
                data: { bookIDs, supplierEmail },
                metadata: { sentBy: req.user.email },
            });
            logger.info(`Sent ${bookIDs.length} books to supplier by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Send to supplier error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to send books to supplier' });
        }
    }

    /**
     * Initiate transfer of receipt books to a recipient.
     * @param {Object} req - Express request object with bookIDs, recipientID, and recipientType in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async transfer(req, res) {
        try {
            const { bookIDs, recipientID, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID) {
                logger.warn(`Transfer failed: Missing bookIDs or recipientID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book IDs (array) and recipient ID are required' });
            }
            const result = await ReceiptBookService.transfer(bookIDs, recipientID, req.user.userID, recipientType);
            // Notify recipient and manager of transfer initiation
            await NotificationService.triggerNotification({
                event: 'receipt_book:transferred',
                data: { bookIDs, recipientID, recipientType },
                metadata: { transferredBy: req.user.email },
            });
            logger.info(`Initiated transfer of ${bookIDs.length} books to ${recipientType} ${recipientID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Transfer error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to initiate transfer' });
        }
    }

    /**
     * Collect receipt books from a supplier.
     * @param {Object} req - Express request object with bookIDs and userID in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async collectFromSupplier(req, res) {
        try {
            const { bookIDs, userID } = req.body;
            if (!Array.isArray(bookIDs) || !userID) {
                logger.warn(`Collect from supplier failed: Missing bookIDs or userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book IDs (array) and user ID are required' });
            }
            const result = await ReceiptBookService.collectFromSupplier(bookIDs, userID);
            // Notify user and manager of books collected
            await NotificationService.triggerNotification({
                event: 'receipt_book:collected',
                data: { bookIDs, userID },
                metadata: { collectedBy: req.user.email },
            });
            logger.info(`Collected ${bookIDs.length} books from supplier by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Collect from supplier error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to collect books from supplier' });
        }
    }

    /**
     * Validate a receipt book transfer.
     * @param {Object} req - Express request object with bookIDs, recipientID, otpCode, and recipientType in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async validateTransfer(req, res) {
        try {
            const { bookIDs, recipientID, otpCode, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID || !otpCode) {
                logger.warn(`Validate transfer failed: Missing bookIDs, recipientID, or otpCode, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book IDs (array), recipient ID, and OTP code are required' });
            }
            const result = await ReceiptBookService.validateTransfer(bookIDs, recipientID, otpCode, recipientType);
            // Notify recipient and manager of transfer validation
            await NotificationService.triggerNotification({
                event: 'receipt_book:transfer_validated',
                data: { bookIDs, recipientID, recipientType },
                metadata: { validatedBy: req.user.email },
            });
            logger.info(`Validated transfer of ${bookIDs.length} books to ${recipientType} ${recipientID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Validate transfer error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to validate transfer' });
        }
    }

    /**
     * Update a receipt book.
     * @param {Object} req - Express request object with bookID in params and updates in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated receipt book or error.
     */
    static async updateReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            const updates = req.body;
            if (!bookID) {
                logger.warn(`Update receipt book failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const receiptBook = await ReceiptBookService.updateReceiptBook(bookID, updates, req.user.userID);
            // Convert Sequelize instance to plain object
            const plainBook = receiptBook.toJSON();
            const responseBook = {
                bookID: plainBook.bookID,
                number: plainBook.number,
                type: plainBook.type,
                status: plainBook.status,
                qrCode: plainBook.qrCode ? Buffer.from(plainBook.qrCode).toString('base64') : null,
                agentID: plainBook.agentID,
                currentHolderID: plainBook.currentHolderID,
                CurrentHolder: plainBook.CurrentHolder || null,
                ReceiptBookTransfers: plainBook.ReceiptBookTransfers || [],
                Agent: plainBook.Agent || null,
                ReceiptStub: plainBook.ReceiptStub || null,
            };
            // Notify holder and manager of updates
            await NotificationService.triggerNotification({
                event: 'receipt_book:updated',
                data: { bookID, updates: Object.keys(updates) },
                metadata: { updatedBy: req.user.email },
            });
            logger.info(`Updated receipt book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseBook);
        } catch (error) {
            logger.error(`Update receipt book error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to update receipt book' });
        }
    }

    /**
     * Delete a receipt book.
     * @param {Object} req - Express request object with bookID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async deleteReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Delete receipt book failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const result = await ReceiptBookService.deleteReceiptBook(bookID, req.user.userID);
            // Notify holder and manager of deletion
            await NotificationService.triggerNotification({
                event: 'receipt_book:deleted',
                data: { bookID },
                metadata: { deletedBy: req.user.email },
            });
            logger.info(`Deleted receipt book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Delete receipt book error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to delete receipt book' });
        }
    }
}

module.exports = ReceiptBookController;