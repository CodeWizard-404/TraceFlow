const ReceiptBookService = require('../services/receiptBookService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing receipt book operations.
 */
class ReceiptBookController {
    // --- Receipt Book Type Management ---
    static async createReceiptBookType(req, res) {
        try {
            const { name } = req.body;
            if (!name) {
                logger.warn(`Create receipt book type failed: Missing name, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Type name is required' });
            }
            const type = await ReceiptBookService.createReceiptBookType(name);
            logger.info(`Receipt book type ${name} created by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(type);
        } catch (error) {
            logger.error(`Create receipt book type error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to create receipt book type' });
        }
    }

    static async getAllReceiptBookTypes(req, res) {
        try {
            const types = await ReceiptBookService.getAllReceiptBookTypes();
            logger.info(`Fetched ${types.length} receipt book types by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(types);
        } catch (error) {
            logger.error(`Get all receipt book types error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve receipt book types' });
        }
    }

    static async getReceiptBookTypeById(req, res) {
        try {
            const { typeID } = req.params;
            if (!typeID) {
                logger.warn(`Get receipt book type failed: Missing typeID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Type ID is required' });
            }
            const type = await ReceiptBookService.getReceiptBookTypeById(typeID);
            logger.info(`Fetched receipt book type ${typeID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(type);
        } catch (error) {
            logger.error(`Get receipt book type error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Receipt book type not found' });
        }
    }

    static async updateReceiptBookType(req, res) {
        try {
            const { typeID } = req.params;
            const { name } = req.body;
            if (!typeID || !name) {
                logger.warn(`Update receipt book type failed: Missing typeID or name, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Type ID and name are required' });
            }
            const type = await ReceiptBookService.updateReceiptBookType(typeID, name);
            logger.info(`Updated receipt book type ${typeID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(type);
        } catch (error) {
            logger.error(`Update receipt book type error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to update receipt book type' });
        }
    }

    static async deleteReceiptBookType(req, res) {
        try {
            const { typeID } = req.params;
            if (!typeID) {
                logger.warn(`Delete receipt book type failed: Missing typeID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Type ID is required' });
            }
            const result = await ReceiptBookService.deleteReceiptBookType(typeID);
            logger.info(`Deleted receipt book type ${typeID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Delete receipt book type error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to delete receipt book type' });
        }
    }

    // --- Receipt Book Retrieval Methods ---
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

    static async getReceiptBookById(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Get receipt book failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`);
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
            logger.info(`Fetched receipt book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseBook);
        } catch (error) {
            logger.error(`Get receipt book error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Receipt book not found' });
        }
    }

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
    static async createReceiptBook(req, res) {
        try {
            const { number, typeID } = req.body;
            if (!number || !typeID) {
                logger.warn(`Create receipt book failed: Missing number or typeID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Number and typeID are required' });
            }
            const receiptBook = await ReceiptBookService.createReceiptBook(number, typeID, req.user.userID);
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
                metadata: { createdBy: req.user.email },
            });
            logger.info(`Receipt book ${number} created by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(responseBook);
        } catch (error) {
            logger.error(`Create receipt book error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to create receipt book' });
        }
    }

    static async sendToSupplier(req, res) {
        try {
            const { bookIDs, supplierEmail } = req.body;
            if (!Array.isArray(bookIDs) || !supplierEmail) {
                logger.warn(`Send to supplier failed: Missing bookIDs or supplierEmail, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book IDs (array) and supplier email are required' });
            }
            const result = await ReceiptBookService.sendToSupplier(bookIDs, supplierEmail, req.user.userID);
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

    static async transfer(req, res) {
        try {
            const { bookIDs, recipientID, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID) {
                logger.warn(`Transfer failed: Missing bookIDs or recipientID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book IDs (array) and recipient ID are required' });
            }
            const result = await ReceiptBookService.transfer(bookIDs, recipientID, req.user.userID, recipientType);
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

    static async collectFromSupplier(req, res) {
        try {
            const { bookIDs, userID } = req.body;
            if (!Array.isArray(bookIDs) || !userID) {
                logger.warn(`Collect from supplier failed: Missing bookIDs or userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book IDs (array) and user ID are required' });
            }
            const result = await ReceiptBookService.collectFromSupplier(bookIDs, userID);
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

    static async validateTransfer(req, res) {
        try {
            const { bookIDs, recipientID, otpCode, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID || !otpCode) {
                logger.warn(`Validate transfer failed: Missing bookIDs, recipientID, or otpCode, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book IDs (array), recipient ID, and OTP code are required' });
            }
            const result = await ReceiptBookService.validateTransfer(bookIDs, recipientID, otpCode, recipientType);
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

    static async updateReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            const updates = req.body;
            if (!bookID) {
                logger.warn(`Update receipt book failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const receiptBook = await ReceiptBookService.updateReceiptBook(bookID, updates, req.user.userID);
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
                metadata: { updatedBy: req.user.email },
            });
            logger.info(`Updated receipt book ${bookID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseBook);
        } catch (error) {
            logger.error(`Update receipt book error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 400).json({ error: error.message || 'Failed to update receipt book' });
        }
    }

    static async deleteReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logger.warn(`Delete receipt book failed: Missing bookID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const result = await ReceiptBookService.deleteReceiptBook(bookID, req.user.userID);
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