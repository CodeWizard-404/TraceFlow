const ReceiptBookService = require('../services/receiptBookService');
const logger = require('../utils/logger');

class ReceiptBookController {
    static async createReceiptBook(req, res) {
        try {
            const { number, type } = req.body;
            if (!number || !type) {
                logger.warn(`Create receipt book failed: Missing number or type, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Number and type are required' });
            }
            const receiptBook = await ReceiptBookService.createReceiptBook(number, type, req.user.userID);
            const responseBook = receiptBook.toJSON();
            responseBook.qrCode = receiptBook.qrCode.toString('base64');
            logger.info(`Receipt book ${number} created by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(201).json(responseBook);
        } catch (error) {
            logger.error(`Create receipt book error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to create receipt book' });
        }
    }

    static async getAllReceiptBooks(req, res) {
        try {
            const receiptBooks = await ReceiptBookService.getAllReceiptBooks();
            const responseBooks = receiptBooks.map(book => {
                const bookData = book.toJSON();
                bookData.qrCode = book.qrCode.toString('base64');
                return bookData;
            });
            logger.info(`Fetched all receipt books by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(responseBooks);
        } catch (error) {
            logger.error(`Get all receipt books error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve receipt books' });
        }
    }

    static async getReceiptBookById(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Get receipt book failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            const responseBook = receiptBook.toJSON();
            responseBook.qrCode = receiptBook.qrCode.toString('base64');
            logger.info(`Fetched receipt book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(responseBook);
        } catch (error) {
            logger.error(`Get receipt book error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 404).json({ error: error.message || 'Receipt book not found' });
        }
    }

    static async getReceiptBookByNumber(req, res) {
        try {
            const { number } = req.params;
            if (!number) {
                logger.warn(`Get receipt book by number failed: Missing number, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book number is required' });
            }
            const receiptBook = await ReceiptBookService.getReceiptBookByNumber(number);
            const responseBook = receiptBook.toJSON();
            responseBook.qrCode = receiptBook.qrCode.toString('base64');
            logger.info(`Fetched receipt book number ${number} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(responseBook);
        } catch (error) {
            logger.error(`Get receipt book by number error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 404).json({ error: error.message || 'Receipt book not found' });
        }
    }

    static async getReceiptBooksByHolder(req, res) {
        try {
            const { holderID } = req.params;
            const { userType } = req.body;
            if (!holderID || !userType) {
                logger.warn(`Get receipt books by holder failed: Missing holderID or userType, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Holder ID and user type are required' });
            }
            const receiptBooks = await ReceiptBookService.getReceiptBooksByHolder(holderID, userType);
            const responseBooks = Array.isArray(receiptBooks)
                ? receiptBooks.map(book => {
                    const bookData = book.toJSON();
                    bookData.qrCode = book.qrCode.toString('base64');
                    return bookData;
                })
                : (() => {
                    const bookData = receiptBooks.toJSON();
                    bookData.qrCode = receiptBooks.qrCode.toString('base64');
                    return bookData;
                })();
            logger.info(`Fetched receipt books for holder ${holderID} (${userType}) by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(responseBooks);
        } catch (error) {
            logger.error(`Get receipt books by holder error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 404).json({ error: error.message || 'Receipt books not found' });
        }
    }

    static async sendToSupplier(req, res) {
        try {
            const { bookIDs, supplierEmail } = req.body;
            if (!Array.isArray(bookIDs) || !supplierEmail) {
                logger.warn(`Send to supplier failed: Missing bookIDs or supplierEmail, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book IDs (array) and supplier email are required' });
            }
            const result = await ReceiptBookService.sendToSupplier(bookIDs, supplierEmail, req.user.userID);
            logger.info(`Sent ${bookIDs.length} books to supplier by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Send to supplier error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to send books to supplier' });
        }
    }

    static async transfer(req, res) {
        try {
            const { bookIDs, recipientID, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID) {
                logger.warn(`Transfer failed: Missing bookIDs or recipientID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book IDs (array) and recipient ID are required' });
            }
            const result = await ReceiptBookService.transfer(bookIDs, recipientID, req.user.userID, recipientType);
            logger.info(`Initiated transfer of ${bookIDs.length} books to ${recipientType} ${recipientID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Transfer error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to initiate transfer' });
        }
    }

    static async collectFromSupplier(req, res) {
        try {
            const { bookIDs, userID } = req.body;
            if (!Array.isArray(bookIDs) || !userID) {
                logger.warn(`Collect from supplier failed: Missing bookIDs or userID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book IDs (array) and user ID are required' });
            }
            const result = await ReceiptBookService.collectFromSupplier(bookIDs, userID);
            logger.info(`Collected ${bookIDs.length} books from supplier by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Collect from supplier error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to collect books from supplier' });
        }
    }

    static async validateTransfer(req, res) {
        try {
            const { bookIDs, recipientID, otpCode, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID || !otpCode) {
                logger.warn(`Validate transfer failed: Missing bookIDs, recipientID, or otpCode, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book IDs (array), recipient ID, and OTP code are required' });
            }
            const result = await ReceiptBookService.validateTransfer(bookIDs, recipientID, otpCode, recipientType);
            logger.info(`Validated transfer of ${bookIDs.length} books to ${recipientType} ${recipientID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Validate transfer error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to validate transfer' });
        }
    }

    static async getTransferHistory(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Get transfer history failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const history = await ReceiptBookService.getTransferHistory(bookID);
            logger.info(`Fetched transfer history for book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(history);
        } catch (error) {
            logger.error(`Get transfer history error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 404).json({ error: error.message || 'Failed to retrieve transfer history' });
        }
    }

    static async updateReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            const updates = req.body;
            if (!bookID) {
                logger.warn(`Update receipt book failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const receiptBook = await ReceiptBookService.updateReceiptBook(bookID, updates, req.user.userID);
            const responseBook = receiptBook.toJSON();
            responseBook.qrCode = receiptBook.qrCode.toString('base64');
            logger.info(`Updated receipt book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(responseBook);
        } catch (error) {
            logger.error(`Update receipt book error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to update receipt book' });
        }
    }

    static async deleteReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Delete receipt book failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const result = await ReceiptBookService.deleteReceiptBook(bookID, req.user.userID);
            logger.info(`Deleted receipt book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Delete receipt book error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to delete receipt book' });
        }
    }
}

module.exports = ReceiptBookController;