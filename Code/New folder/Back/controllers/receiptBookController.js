const ReceiptBookService = require('../services/receiptBookService');
const NotificationService = require('../services/notificationService');
const { ReceiptBook, User, ReceiptBookType } = require('../models');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');

/**
 * Controller for managing receipt book operations with structured logging and notifications.
 */
class ReceiptBookController {
    // --- Receipt Book Type Management ---

    static async createReceiptBookType(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { name } = req.body;
            if (!name) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Type name is required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-book-types'
                });
                return res.status(400).json({ error: 'Type name is required' });
            }

            const type = await ReceiptBookService.createReceiptBookType(name, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_book_types');
            await redis.set('receipt_book_types:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_book_types');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'receipt_book_type:created',
                data: { typeID: type.typeID, name },
                metadata: { createdBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'receipt_book',
                customMessage: `Receipt book type ${name} created`,
                requestID,
            });

            logRequest({
                req,
                res: type,
                status: 201,
                message: `Created receipt book type ${type.typeID}`,
                level: 'info',
                metadata: { typeID: type.typeID, name, requestID },
                service: 'receipt_book',
                defaultRoute: 'receipt-book-types'
            });

            await transaction.commit();
            return res.status(201).json(type);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to create receipt book type: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-book-types'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to create receipt book type' });
        }
    }

    static async getAllReceiptBookTypes(req, res) {
        try {
            const cacheInstance = await cache();
            const types = await cacheInstance.getOrSet('receipt_book_types:all', async () => {
                return await ReceiptBookService.getAllReceiptBookTypes();
            }, 'api');

            logRequest({
                req,
                res: types,
                status: 200,
                message: `Retrieved ${types.length} receipt book types`,
                level: 'info',
                metadata: { typeCount: types.length },
                service: 'receipt_book',
                defaultRoute: 'receipt-book-types'
            });

            return res.status(200).json(types);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch receipt book types: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-book-types'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve receipt book types' });
        }
    }

    static async getReceiptBookTypeById(req, res) {
        try {
            const { typeID } = req.params;
            if (!typeID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Type ID is required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-book-types'
                });
                return res.status(400).json({ error: 'Type ID is required' });
            }

            const cacheInstance = await cache();
            const type = await cacheInstance.getOrSet(`receipt_book_type:${typeID}`, async () => {
                return await ReceiptBookService.getReceiptBookTypeById(typeID);
            }, 'api');

            logRequest({
                req,
                res: type,
                status: 200,
                message: `Retrieved receipt book type ${typeID}`,
                level: 'info',
                metadata: { typeID },
                service: 'receipt_book',
                defaultRoute: 'receipt-book-types'
            });

            return res.status(200).json(type);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to fetch receipt book type: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-book-types'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Receipt book type not found' });
        }
    }

    static async updateReceiptBookType(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { typeID } = req.params;
            const { name } = req.body;
            if (!typeID || !name) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Type ID and name are required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-book-types'
                });
                return res.status(400).json({ error: 'Type ID and name are required' });
            }

            const type = await ReceiptBookService.updateReceiptBookType(typeID, name, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_book_types');
            await cacheInstance.invalidate(`receipt_book_type:${typeID}`);
            await redis.set('receipt_book_types:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `receipt_book_type:${typeID}`);
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_book_types');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'receipt_book_type:updated',
                data: { typeID, name },
                metadata: { updatedBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'receipt_book',
                customMessage: `Receipt book type ${name} updated`,
                requestID,
            });

            logRequest({
                req,
                res: type,
                status: 200,
                message: `Updated receipt book type ${typeID}`,
                level: 'info',
                metadata: { typeID, name, requestID },
                service: 'receipt_book',
                defaultRoute: 'receipt-book-types'
            });

            await transaction.commit();
            return res.status(200).json(type);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to update receipt book type: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-book-types'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to update receipt book type' });
        }
    }

    static async deleteReceiptBookType(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { typeID } = req.params;
            if (!typeID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Type ID is required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-book-types'
                });
                return res.status(400).json({ error: 'Type ID is required' });
            }
            const type = await ReceiptBook.findByPk(typeID);
            const result = await ReceiptBookService.deleteReceiptBookType(typeID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_book_types');
            await cacheInstance.invalidate(`receipt_book_type:${typeID}`);
            await redis.set('receipt_book_types:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `receipt_book_type:${typeID}`);
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_book_types');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'receipt_book_type:deleted',
                data: { typeID },
                metadata: { deletedBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'receipt_book',
                customMessage: `Receipt book type ${type} deleted`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Deleted receipt book type ${typeID}`,
                level: 'info',
                metadata: { typeID, requestID },
                service: 'receipt_book',
                defaultRoute: 'receipt-book-types'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to delete receipt book type: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-book-types'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to delete receipt book type' });
        }
    }

    // --- Receipt Book Retrieval Methods ---

    static async getAllReceiptBooks(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                sortField = 'number',
                sortOrder = 'ASC',
                searchQuery = '',
                filterType = 'all',
                filterStatus = 'all',
            } = req.query;

            const validSortFields = ['number', 'holder', 'bookStatus', 'stubStatus', 'type'];
            if (!validSortFields.includes(sortField)) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Invalid sort field',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Invalid sort field' });
            }

            if (!['ASC', 'DESC'].includes(sortOrder.toUpperCase())) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Invalid sort order',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Invalid sort order' });
            }

            const cacheInstance = await cache();
            const cacheKey = `receipt_books:page:${page}:limit:${limit}:sort:${sortField}:${sortOrder}:search:${searchQuery}:type:${filterType}:status:${filterStatus}`;
            const result = await cacheInstance.getOrSet(cacheKey, async () => {
                return await ReceiptBookService.getAllReceiptBooks(
                    parseInt(page),
                    parseInt(limit),
                    sortField,
                    sortOrder,
                    searchQuery,
                    filterType,
                    filterStatus
                );
            }, 'api');

            const responseBooks = result.books.map(book => ({
                ...book,
                qrCode: book.qrCode ? Buffer.from(book.qrCode).toString('base64') : null,
            }));

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Retrieved ${responseBooks.length} receipt books`,
                level: 'info',
                metadata: { bookCount: responseBooks.length },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            return res.status(200).json({
                books: responseBooks,
                totalCount: result.totalCount,
                currentPage: result.currentPage,
                totalPages: result.totalPages,
            });
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch receipt books: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 500).json({ error: error.message });
        }
    }

    static async getReceiptBookHolders(req, res) {
        try {
            const cacheInstance = await cache();
            const holders = await cacheInstance.getOrSet('receipt_book_holders', async () => {
                return await ReceiptBookService.getReceiptBookHolders();
            }, 'api');

            logRequest({
                req,
                res: holders,
                status: 200,
                message: `Retrieved ${holders.length} receipt book holders`,
                level: 'info',
                metadata: { holderCount: holders.length },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            return res.status(200).json(holders);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch receipt book holders: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch receipt book holders' });
        }
    }

    static async getReceiptBookById(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Book ID is required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Book ID is required' });
            }

            const cacheInstance = await cache();
            const receiptBook = await cacheInstance.getOrSet(`receipt_book:${bookID}`, async () => {
                return await ReceiptBookService.getReceiptBookById(bookID);
            }, 'api');

            const responseBook = {
                ...receiptBook,
                qrCode: receiptBook.qrCode ? Buffer.from(receiptBook.qrCode).toString('base64') : null,
            };

            logRequest({
                req,
                res: responseBook,
                status: 200,
                message: `Retrieved receipt book ${bookID}`,
                level: 'info',
                metadata: { bookID },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            return res.status(200).json(responseBook);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to fetch receipt book: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Receipt book not found' });
        }
    }

    static async getReceiptBookByNumber(req, res) {
        try {
            const { number } = req.params;
            if (!number) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Book number is required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Book number is required' });
            }

            const cacheInstance = await cache();
            const receiptBook = await cacheInstance.getOrSet(`receipt_book:number:${number}`, async () => {
                return await ReceiptBookService.getReceiptBookByNumber(number);
            }, 'api');

            const responseBook = {
                ...receiptBook,
                qrCode: receiptBook.qrCode ? Buffer.from(receiptBook.qrCode).toString('base64') : null,
            };

            logRequest({
                req,
                res: responseBook,
                status: 200,
                message: `Retrieved receipt book number ${number}`,
                level: 'info',
                metadata: { number },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            return res.status(200).json(responseBook);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to fetch receipt book by number: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Receipt book not found' });
        }
    }

    static async getReceiptBooksByHolder(req, res) {
        try {
            const { holderID } = req.params;
            const { userType } = req.body;
            if (!holderID || !userType) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Holder ID and user type are required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Holder ID and user type are required' });
            }

            const cacheInstance = await cache();
            const receiptBooks = await cacheInstance.getOrSet(`receipt_books:holder:${holderID}:${userType}`, async () => {
                return await ReceiptBookService.getReceiptBooksByHolder(holderID, userType);
            }, 'api');

            const responseBooks = Array.isArray(receiptBooks)
                ? receiptBooks.map(book => ({
                    ...book,
                    qrCode: book.qrCode ? Buffer.from(book.qrCode).toString('base64') : null,
                }))
                : {
                    ...receiptBooks,
                    qrCode: receiptBooks.qrCode ? Buffer.from(receiptBooks.qrCode).toString('base64') : null,
                };

            logRequest({
                req,
                res: responseBooks,
                status: 200,
                message: `Retrieved receipt books for holder ${holderID}`,
                level: 'info',
                metadata: { holderID, userType, bookCount: Array.isArray(responseBooks) ? responseBooks.length : 1 },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            return res.status(200).json(responseBooks);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch receipt books by holder: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 500).json({ error: error.message || 'An error occurred while fetching receipt books' });
        }
    }

    static async getTransferHistory(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Book ID is required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Book ID is required' });
            }

            const cacheInstance = await cache();
            const history = await cacheInstance.getOrSet(`receipt_book_transfers:${bookID}`, async () => {
                return await ReceiptBookService.getTransferHistory(bookID);
            }, 'api');

            // Log a warning if the history is unusually large
            if (Array.isArray(history) && history.length > 100) {
                logRequest({
                    req,
                    status: 200,
                    message: `Large transfer history detected for book ${bookID}`,
                    level: 'warn',
                    metadata: { bookID, transferCount: history.length },
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
            }

            logRequest({
                req,
                res: history,
                status: 200,
                message: `Retrieved transfer history for book ${bookID}`,
                level: 'info',
                metadata: { bookID, transferCount: history.length },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            return res.status(200).json(history);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to fetch transfer history: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Failed to retrieve transfer history' });
        }
    }

    // --- Receipt Book Modification Methods ---

    static async createReceiptBook(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { number, typeID } = req.body;
            if (!number || !typeID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Number and typeID are required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Number and typeID are required' });
            }

            const receiptBook = await ReceiptBookService.createReceiptBook(number, typeID, req.user.userID, { transaction });
            const plainBook = receiptBook.toJSON();
            const responseBook = {
                ...plainBook,
                type: plainBook.ReceiptBookType ? plainBook.ReceiptBookType.name : null,
                qrCode: plainBook.qrCode ? Buffer.from(plainBook.qrCode).toString('base64') : null,
            };
            delete responseBook.ReceiptBookType;

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_books');
            await cacheInstance.invalidate(`receipt_book:${receiptBook.bookID}`);
            await redis.set('receipt_books:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `receipt_book:${receiptBook.bookID}`);
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_books');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'receipt_book:created',
                data: { bookID: receiptBook.bookID, number, typeID },
                metadata: { createdBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'receipt_book',
                customMessage: `Receipt book ${number} created`,
                requestID,
            });

            logRequest({
                req,
                res: responseBook,
                status: 201,
                message: `Created receipt book ${receiptBook.bookID}`,
                level: 'info',
                metadata: { bookID: receiptBook.bookID, number, requestID },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            await transaction.commit();
            return res.status(201).json(responseBook);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to create receipt book: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to create receipt book' });
        }
    }

    static async sendToSupplier(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { transferID, bookIDs, supplierEmail, isPartial } = req.body;
            if (!transferID || (!isPartial && !supplierEmail) || (isPartial && (!Array.isArray(bookIDs) || !supplierEmail))) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Transfer ID, book IDs (array, if partial), and supplier email are required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Transfer ID, book IDs (array, if partial), and supplier email are required' });
            }

            const result = await ReceiptBookService.sendToSupplier(transferID, bookIDs || [], supplierEmail, isPartial, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_books');
            if (bookIDs) {
                for (const bookID of bookIDs) {
                    await cacheInstance.invalidate(`receipt_book:${bookID}`);
                    await RedisUtils.publishEvent('cache:invalidate', `receipt_book:${bookID}`);
                }
            }
            await redis.set('receipt_books:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_books');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'receipt_book:sent',
                data: { bookCount: result.message.match(/\d+/)?.[0] || 0, supplierEmail },
                metadata: { sentBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'receipt_book',
                customMessage: `${result.message.match(/\d+/)?.[0] || 0} books sent to supplier`,
                requestID,
            });

            if (!isPartial) {
                logRequest({
                    req,
                    res: result,
                    status: 200,
                    message: `Processed send to supplier request for ${bookIDs?.length || 0} books`,
                    level: 'info',
                    metadata: { transferID, isPartial, bookCount: bookIDs?.length || 0, requestID },
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
            } else {
                logRequest({
                    req,
                    res: result,
                    status: 200,
                    message: `Processed partial send to supplier request for ${bookIDs?.length || 0} books`,
                    level: 'info',
                    metadata: { transferID, isPartial, bookCount: bookIDs?.length || 0, requestID },
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
            }

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to send receipt books to supplier: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to send books to supplier' });
        }
    }

    static async transfer(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { bookIDs, recipientID, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Book IDs (array) and recipient ID are required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Book IDs (array) and recipient ID are required' });
            }

            const result = await ReceiptBookService.transfer(bookIDs, recipientID, req.user.userID, recipientType, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_books');
            for (const bookID of bookIDs) {
                await cacheInstance.invalidate(`receipt_book:${bookID}`);
                await RedisUtils.publishEvent('cache:invalidate', `receipt_book:${bookID}`);
            }
            await redis.set('receipt_books:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_books');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'receipt_book:transferred',
                data: { bookIDs, recipientID, recipientType },
                metadata: { transferredBy: req.user.email },
                dynamicRecipients: recipientType === 'user' ? [recipientID] : [],
                triggeredByUserID: req.user.userID,
                type: 'receipt_book',
                customMessage: `Transferred ${bookIDs.length} receipt books`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Initiated transfer of ${bookIDs.length} receipt books`,
                level: 'info',
                metadata: { bookCount: bookIDs.length, recipientID, recipientType, requestID },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to initiate transfer of receipt books: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to initiate transfer' });
        }
    }

    static async collectFromSupplier(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { bookIDs, userID } = req.body;
            if (!Array.isArray(bookIDs) || !userID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Book IDs (array) and user ID are required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Book IDs (array) and user ID are required' });
            }

            const result = await ReceiptBookService.collectFromSupplier(bookIDs, userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_books');
            for (const bookID of bookIDs) {
                await cacheInstance.invalidate(`receipt_book:${bookID}`);
                await RedisUtils.publishEvent('cache:invalidate', `receipt_book:${bookID}`);
            }
            await redis.set('receipt_books:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_books');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'receipt_book:collected',
                data: { bookIDs, userID },
                metadata: { collectedBy: req.user.email },
                dynamicRecipients: [userID],
                triggeredByUserID: req.user.userID,
                type: 'receipt_book',
                customMessage: `Collected ${bookIDs.length} receipt books from supplier`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Collected ${bookIDs.length} receipt books from supplier`,
                level: 'info',
                metadata: { bookCount: bookIDs.length, userID, requestID },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to collect receipt books from supplier: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to collect books from supplier' });
        }
    }

    static async validateTransfer(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { bookIDs, recipientID, otpCode, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID || !otpCode) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Book IDs (array), recipient ID, and OTP code are required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Book IDs (array), recipient ID, and OTP code are required' });
            }

            const result = await ReceiptBookService.validateTransfer(bookIDs, recipientID, otpCode, recipientType, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_books');
            for (const bookID of bookIDs) {
                await cacheInstance.invalidate(`receipt_book:${bookID}`);
                await RedisUtils.publishEvent('cache:invalidate', `receipt_book:${bookID}`);
            }
            await redis.set('receipt_books:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_books');

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Validated transfer of ${bookIDs.length} receipt books`,
                level: 'info',
                metadata: { bookCount: bookIDs.length, recipientID, recipientType },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to validate transfer of receipt books: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to validate transfer' });
        }
    }

    static async updateReceiptBook(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { bookID } = req.params;
            const updates = req.body;
            if (!bookID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Book ID is required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Book ID is required' });
            }

            const book = await ReceiptBook.findByPk(bookID, { transaction });
            const receiptBook = await ReceiptBookService.updateReceiptBook(bookID, updates, req.user.userID, { transaction });
            const plainBook = receiptBook.toJSON();
            const responseBook = {
                ...plainBook,
                type: plainBook.ReceiptBookType ? plainBook.ReceiptBookType.name : null,
                qrCode: plainBook.qrCode ? Buffer.from(plainBook.qrCode).toString('base64') : null,
                CurrentHolder: plainBook.CurrentHolder || null,
                ReceiptBookTransfers: plainBook.ReceiptBookTransfers || [],
                Agent: plainBook.Agent || null,
                ReceiptStub: plainBook.ReceiptStub || null,
            };

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_books');
            await cacheInstance.invalidate(`receipt_book:${bookID}`);
            await redis.set('receipt_books:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `receipt_book:${bookID}`);
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_books');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'receipt_book:updated',
                data: { bookID, updates: Object.keys(updates) },
                metadata: { updatedBy: req.user.email },
                dynamicRecipients: [plainBook.CurrentHolder?.userID].filter(Boolean),
                triggeredByUserID: req.user.userID,
                type: 'receipt_book',
                customMessage: `Receipt book ${book.number} updated`,
                requestID,
            });

            logRequest({
                req,
                res: responseBook,
                status: 200,
                message: `Updated receipt book ${bookID}`,
                level: 'info',
                metadata: { bookID, updateCount: Object.keys(updates).length, requestID },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            await transaction.commit();
            return res.status(200).json(responseBook);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to update receipt book: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to update receipt book' });
        }
    }

    static async deleteReceiptBook(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { bookID } = req.params;
            if (!bookID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Book ID is required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'Book ID is required' });
            }

            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            const holderID = receiptBook?.CurrentHolder?.userID;

            const { number } = receiptBook;
            const result = await ReceiptBookService.deleteReceiptBook(bookID, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_books');
            await cacheInstance.invalidate(`receipt_book:${bookID}`);
            await redis.set('receipt_books:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', `receipt_book:${bookID}`);
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_books');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'receipt_book:deleted',
                data: { bookID },
                metadata: { deletedBy: req.user.email },
                dynamicRecipients: [holderID].filter(Boolean),
                triggeredByUserID: req.user.userID,
                type: 'receipt_book',
                customMessage: `Receipt book ${number} deleted`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Deleted receipt book ${bookID}`,
                level: 'info',
                metadata: { bookID, requestID },
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 400,
                message: `Failed to delete receipt book: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 400).json({ error: error.message || 'Failed to delete receipt book' });
        }
    }

    static async uploadReceiptBooksCSV(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            if (!req.file) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'CSV file is required',
                    level: 'info',
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
                return res.status(400).json({ error: 'CSV file is required' });
            }

            const result = await ReceiptBookService.processReceiptBookCSV(req.file.buffer, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('receipt_books');
            await redis.set('receipt_books:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'receipt_books');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'receipt_book:csv_uploaded',
                data: {
                    totalBooks: result.summary.booksCreated,
                    actorID: req.user.userID
                },
                metadata: { createdBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'receipt_book',
                customMessage: `CSV created ${result.summary.booksCreated} receipt books`,
                requestID,
            });

            if (result.summary.booksCreated > 0) {
                logRequest({
                    req,
                    res: result,
                    status: 200,
                    message: `Processed receipt books CSV with ${result.summary.booksCreated} books created`,
                    level: 'info',
                    metadata: {
                        totalRecords: result.summary.totalRecords,
                        booksCreated: result.summary.booksCreated,
                        recordsSkipped: result.summary.recordsSkipped,
                        errorsEncountered: result.summary.errorsEncountered,
                        requestID
                    },
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
            } else {
                logRequest({
                    req,
                    res: result,
                    status: 200,
                    message: `Processed receipt books CSV with no books created`,
                    level: 'info',
                    metadata: {
                        totalRecords: result.summary.totalRecords,
                        booksCreated: result.summary.booksCreated,
                        recordsSkipped: result.summary.recordsSkipped,
                        errorsEncountered: result.summary.errorsEncountered
                    },
                    service: 'receipt_book',
                    defaultRoute: 'receipt-books'
                });
            }

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to process receipt books CSV: ${error.message}`,
                level: 'error',
                service: 'receipt_book',
                defaultRoute: 'receipt-books'
            });
            return res.status(error.status || 500).json({
                error: error.message || 'Failed to process receipt books CSV'
            });
        }
    }
}

module.exports = ReceiptBookController;