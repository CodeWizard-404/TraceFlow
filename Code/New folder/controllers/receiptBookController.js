const ReceiptBookService = require('../services/receiptBookService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing receipt book operations with structured logging.
 */
class ReceiptBookController {
    // --- Receipt Book Type Management ---

    /**
     * Create a new receipt book type.
     * @param {Object} req - Express request object with name in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created type or error.
     */
    static async createReceiptBookType(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { name } = req.body;
            if (!name) {
                logger.warn('Create receipt book type failed: Missing name', {
                    route: 'receipt-book-types',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Type name is required' });
            }
            const type = await ReceiptBookService.createReceiptBookType(name);
            logger.info('Successfully created receipt book type', {
                route: 'receipt-book-types',
                method: req.method,
                url: req.originalUrl,
                status: 201,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { typeID: type.typeID, name }
            });
            return res.status(201).json(type);
        } catch (error) {
            logger.error('Failed to create receipt book type', {
                route: 'receipt-book-types',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to create receipt book type' });
        }
    }

    /**
     * Get all receipt book types.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with types or error.
     */
    static async getAllReceiptBookTypes(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const types = await ReceiptBookService.getAllReceiptBookTypes();
            logger.info('Successfully fetched receipt book types', {
                route: 'receipt-book-types',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { typeCount: types.length }
            });
            return res.status(200).json(types);
        } catch (error) {
            logger.error('Failed to fetch receipt book types', {
                route: 'receipt-book-types',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve receipt book types' });
        }
    }

    /**
     * Get a receipt book type by ID.
     * @param {Object} req - Express request object with typeID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with type or error.
     */
    static async getReceiptBookTypeById(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { typeID } = req.params;
            if (!typeID) {
                logger.warn('Get receipt book type failed: Missing typeID', {
                    route: 'receipt-book-types',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Type ID is required' });
            }
            const type = await ReceiptBookService.getReceiptBookTypeById(typeID);
            logger.info('Successfully fetched receipt book type', {
                route: 'receipt-book-types',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { typeID }
            });
            return res.status(200).json(type);
        } catch (error) {
            logger.error('Failed to fetch receipt book type', {
                route: 'receipt-book-types',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 404).json({ error: error.message || 'Receipt book type not found' });
        }
    }

    /**
     * Update a receipt book type.
     * @param {Object} req - Express request object with typeID in params and name in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated type or error.
     */
    static async updateReceiptBookType(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { typeID } = req.params;
            const { name } = req.body;
            if (!typeID || !name) {
                logger.warn('Update receipt book type failed: Missing typeID or name', {
                    route: 'receipt-book-types',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Type ID and name are required' });
            }
            const type = await ReceiptBookService.updateReceiptBookType(typeID, name);
            logger.info('Successfully updated receipt book type', {
                route: 'receipt-book-types',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { typeID, name }
            });
            return res.status(200).json(type);
        } catch (error) {
            logger.error('Failed to update receipt book type', {
                route: 'receipt-book-types',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to update receipt book type' });
        }
    }

    /**
     * Delete a receipt book type.
     * @param {Object} req - Express request object with typeID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with success message or error.
     */
    static async deleteReceiptBookType(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { typeID } = req.params;
            if (!typeID) {
                logger.warn('Delete receipt book type failed: Missing typeID', {
                    route: 'receipt-book-types',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Type ID is required' });
            }
            const result = await ReceiptBookService.deleteReceiptBookType(typeID);
            logger.info('Successfully deleted receipt book type', {
                route: 'receipt-book-types',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { typeID }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to delete receipt book type', {
                route: 'receipt-book-types',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to delete receipt book type' });
        }
    }

    // --- Receipt Book Retrieval Methods ---

    /**
     * Get all receipt books.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with receipt books or error.
     */
    static async getAllReceiptBooks(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const startTime = Date.now();
            const receiptBooks = await ReceiptBookService.getAllReceiptBooks();
            const responseBooks = receiptBooks.map(book => ({
                ...book,
                qrCode: book.qrCode ? Buffer.from(book.qrCode).toString('base64') : null,
            }));
            logger.info('Successfully fetched receipt books', {
                route: 'receipt-books',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookCount: responseBooks.length, durationMs: Date.now() - startTime }
            });
            return res.status(200).json(responseBooks);
        } catch (error) {
            logger.error('Failed to fetch receipt books', {
                route: 'receipt-books',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn('Get receipt book failed: Missing bookID', {
                    route: 'receipt-books',
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
            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            const plainBook = receiptBook.toJSON();
            const responseBook = {
                bookID: plainBook.bookID,
                number: plainBook.number,
                type: plainBook.ReceiptBookType ? plainBook.ReceiptBookType.name : null,
                status: plainBook.status,
                qrCode: plainBook.qrCode ? Buffer.from(plainBook.qrCode).toString('base64') : null,
                agentID: plainBook.agentID,
                currentHolderID: plainBook.currentHolderID,
                typeID: plainBook.typeID,
                CurrentHolder: plainBook.CurrentHolder || null,
                ReceiptBookTransfers: plainBook.ReceiptBookTransfers || [],
                Agent: plainBook.Agent || null,
                ReceiptStub: plainBook.ReceiptStub || null,
            };
            logger.info('Successfully fetched receipt book', {
                route: 'receipt-books',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookID }
            });
            return res.status(200).json(responseBook);
        } catch (error) {
            logger.error('Failed to fetch receipt book', {
                route: 'receipt-books',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { number } = req.params;
            if (!number) {
                logger.warn('Get receipt book by number failed: Missing number', {
                    route: 'receipt-books/number',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Book number is required' });
            }
            const receiptBook = await ReceiptBookService.getReceiptBookByNumber(number);
            const responseBook = {
                ...receiptBook,
                qrCode: receiptBook.qrCode ? Buffer.from(receiptBook.qrCode).toString('base64') : null,
            };
            logger.info('Successfully fetched receipt book by number', {
                route: 'receipt-books/number',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { number }
            });
            return res.status(200).json(responseBook);
        } catch (error) {
            logger.error('Failed to fetch receipt book by number', {
                route: 'receipt-books/number',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { holderID } = req.params;
            const { userType } = req.body;
            if (!holderID || !userType) {
                logger.warn('Get receipt books by holder failed: Missing holderID or userType', {
                    route: 'receipt-books/holder',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
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
            logger.info('Successfully fetched receipt books by holder', {
                route: 'receipt-books/holder',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { holderID, userType, bookCount: Array.isArray(responseBooks) ? responseBooks.length : 1 }
            });
            return res.status(200).json(responseBooks);
        } catch (error) {
            logger.error('Failed to fetch receipt books by holder', {
                route: 'receipt-books/holder',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn('Get transfer history failed: Missing bookID', {
                    route: 'receipt-books/transfer-history',
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
            const history = await ReceiptBookService.getTransferHistory(bookID);
            logger.info('Successfully fetched transfer history', {
                route: 'receipt-books/transfer-history',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookID, transferCount: history.length }
            });
            return res.status(200).json(history);
        } catch (error) {
            logger.error('Failed to fetch transfer history', {
                route: 'receipt-books/transfer-history',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 404).json({ error: error.message || 'Failed to retrieve transfer history' });
        }
    }

    // --- Receipt Book Modification Methods ---

    /**
     * Create a new receipt book.
     * @param {Object} req - Express request object with number and typeID in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created receipt book or error.
     */
    static async createReceiptBook(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { number, typeID } = req.body;
            if (!number || !typeID) {
                logger.warn('Create receipt book failed: Missing number or typeID', {
                    route: 'receipt-books',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Number and typeID are required' });
            }
            const receiptBook = await ReceiptBookService.createReceiptBook(number, typeID, actorID);
            const plainBook = receiptBook.toJSON();
            const responseBook = {
                ...plainBook,
                type: plainBook.ReceiptBookType ? plainBook.ReceiptBookType.name : null,
                qrCode: plainBook.qrCode ? Buffer.from(plainBook.qrCode).toString('base64') : null,
            };
            delete responseBook.ReceiptBookType;
            await NotificationService.triggerNotification({
                event: 'receipt_book:created',
                data: { bookID: receiptBook.bookID, number, typeID },
                metadata: { createdBy: req.user.email }
            });
            logger.info('Successfully created receipt book', {
                route: 'receipt-books',
                method: req.method,
                url: req.originalUrl,
                status: 201,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookID: receiptBook.bookID, number }
            });
            return res.status(201).json(responseBook);
        } catch (error) {
            logger.error('Failed to create receipt book', {
                route: 'receipt-books',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to create receipt book' });
        }
    }

    /**
     * Send receipt books to supplier.
     * @param {Object} req - Express request object with bookIDs and supplierEmail in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async sendToSupplier(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookIDs, supplierEmail } = req.body;
            if (!Array.isArray(bookIDs) || !supplierEmail) {
                logger.warn('Send to supplier failed: Missing bookIDs or supplierEmail', {
                    route: 'receipt-books/send-to-supplier',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Book IDs (array) and supplier email are required' });
            }
            const result = await ReceiptBookService.sendToSupplier(bookIDs, supplierEmail, actorID);
            await NotificationService.triggerNotification({
                event: 'receipt_book:sent_to_supplier',
                data: { bookIDs, supplierEmail },
                metadata: { sentBy: req.user.email }
            });
            logger.info('Successfully sent receipt books to supplier', {
                route: 'receipt-books/send-to-supplier',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookCount: bookIDs.length, supplierEmail }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to send receipt books to supplier', {
                route: 'receipt-books/send-to-supplier',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to send books to supplier' });
        }
    }

    /**
     * Transfer receipt books to a recipient.
     * @param {Object} req - Express request object with bookIDs, recipientID, and recipientType in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async transfer(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookIDs, recipientID, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID) {
                logger.warn('Transfer failed: Missing bookIDs or recipientID', {
                    route: 'receipt-books/transfer',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Book IDs (array) and recipient ID are required' });
            }
            const result = await ReceiptBookService.transfer(bookIDs, recipientID, actorID, recipientType);
            await NotificationService.triggerNotification({
                event: 'receipt_book:transferred',
                data: { bookIDs, recipientID, recipientType },
                metadata: { transferredBy: req.user.email }
            });
            logger.info('Successfully initiated transfer of receipt books', {
                route: 'receipt-books/transfer',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookCount: bookIDs.length, recipientID, recipientType }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to initiate transfer of receipt books', {
                route: 'receipt-books/transfer',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to initiate transfer' });
        }
    }

    /**
     * Collect receipt books from supplier.
     * @param {Object} req - Express request object with bookIDs and userID in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async collectFromSupplier(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookIDs, userID } = req.body;
            if (!Array.isArray(bookIDs) || !userID) {
                logger.warn('Collect from supplier failed: Missing bookIDs or userID', {
                    route: 'receipt-books/collect-from-supplier',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Book IDs (array) and user ID are required' });
            }
            const result = await ReceiptBookService.collectFromSupplier(bookIDs, userID);
            await NotificationService.triggerNotification({
                event: 'receipt_book:collected',
                data: { bookIDs, userID },
                metadata: { collectedBy: req.user.email }
            });
            logger.info('Successfully collected receipt books from supplier', {
                route: 'receipt-books/collect-from-supplier',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookCount: bookIDs.length, userID }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to collect receipt books from supplier', {
                route: 'receipt-books/collect-from-supplier',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookIDs, recipientID, otpCode, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID || !otpCode) {
                logger.warn('Validate transfer failed: Missing bookIDs, recipientID, or otpCode', {
                    route: 'receipt-books/validate-transfer',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Book IDs (array), recipient ID, and OTP code are required' });
            }
            const result = await ReceiptBookService.validateTransfer(bookIDs, recipientID, otpCode, recipientType);
            await NotificationService.triggerNotification({
                event: 'receipt_book:transfer_validated',
                data: { bookIDs, recipientID, recipientType },
                metadata: { validatedBy: req.user.email }
            });
            logger.info('Successfully validated transfer of receipt books', {
                route: 'receipt-books/validate-transfer',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookCount: bookIDs.length, recipientID, recipientType }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to validate transfer of receipt books', {
                route: 'receipt-books/validate-transfer',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookID } = req.params;
            const updates = req.body;
            if (!bookID) {
                logger.warn('Update receipt book failed: Missing bookID', {
                    route: 'receipt-books',
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
            const receiptBook = await ReceiptBookService.updateReceiptBook(bookID, updates, actorID);
            const plainBook = receiptBook.toJSON();
            const responseBook = {
                bookID: plainBook.bookID,
                number: plainBook.number,
                type: plainBook.ReceiptBookType ? plainBook.ReceiptBookType.name : null,
                status: plainBook.status,
                qrCode: plainBook.qrCode ? Buffer.from(plainBook.qrCode).toString('base64') : null,
                agentID: plainBook.agentID,
                currentHolderID: plainBook.currentHolderID,
                typeID: plainBook.typeID,
                CurrentHolder: plainBook.CurrentHolder || null,
                ReceiptBookTransfers: plainBook.ReceiptBookTransfers || [],
                Agent: plainBook.Agent || null,
                ReceiptStub: plainBook.ReceiptStub || null,
            };
            await NotificationService.triggerNotification({
                event: 'receipt_book:updated',
                data: { bookID, updates: Object.keys(updates) },
                metadata: { updatedBy: req.user.email }
            });
            logger.info('Successfully updated receipt book', {
                route: 'receipt-books',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { bookID, updateCount: Object.keys(updates).length }
            });
            return res.status(200).json(responseBook);
        } catch (error) {
            logger.error('Failed to update receipt book', {
                route: 'receipt-books',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to update receipt book' });
        }
    }

    /**
     * Delete a receipt book.
     * @param {Object} req - Express request object with bookID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with success message or error.
     */
    static async deleteReceiptBook(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn('Delete receipt book failed: Missing bookID', {
                    route: 'receipt-books',
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
            const result = await ReceiptBookService.deleteReceiptBook(bookID, actorID);
            await NotificationService.triggerNotification({
                event: 'receipt_book:deleted',
                data: { bookID },
                metadata: { deletedBy: req.user.email }
            });
            logger.info('Successfully deleted receipt book', {
                route: 'receipt-books',
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
            logger.error('Failed to delete receipt book', {
                route: 'receipt-books',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 400,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to delete receipt book' });
        }
    }
}

module.exports = ReceiptBookController;