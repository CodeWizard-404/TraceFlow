const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const { ReceiptBook, User, Agent, OTP, ReceiptBookTransfer, ReceiptStub, Role } = require('../models');
const OTPService = require('../services/otpService');
const QRGenerator = require('../utils/qrGenerator');
const logger = require('../utils/logger');
const { Sequelize } = require('sequelize');

class ReceiptBookService {
    static async createReceiptBook(number, type, purchaseUserID) {
        try {
            const qrCode = await QRGenerator.generateReceiptBookQR(number, type);
            const book = await ReceiptBook.create({
                number,
                type,
                qrCode,
                status: 'In Stock',
                currentHolderID: purchaseUserID,
            });

            await ReceiptStub.create({ bookID: book.bookID, status: 'pending' });
            await this.logTransfer(book.bookID, purchaseUserID, null, 'Pending', 'ToSupplier');

            logger.info(`Receipt book ${number} created by user ${purchaseUserID}`, { ip: null });
            return book;
        } catch (error) {
            logger.error(`Create receipt book error: ${error.message}, user: ${purchaseUserID}`, { ip: null });
            const err = new Error('Failed to create receipt book: ' + error.message);
            err.status = 400;
            throw err;
        }
    }

    static async getReceiptBookById(bookID) {
        try {
            const startTime = Date.now();
            const book = await ReceiptBook.findByPk(bookID, {
                attributes: ['bookID', 'number', 'type', 'status', 'qrCode', 'agentID', 'currentHolderID'],
                include: [
                    { model: User, as: 'CurrentHolder', attributes: ['userID', 'firstname', 'lastname'] },
                    { model: ReceiptBookTransfer, attributes: ['transferID', 'transferType', 'transferDate'] },
                    { model: Agent, attributes: ['agentID', 'name', 'lastname'] },
                    { model: ReceiptStub, attributes: ['stubID', 'status'] },
                ],
            });
            if (!book) {
                const error = new Error('Receipt book not found');
                error.status = 404;
                throw error;
            }
            logger.info(`Fetched receipt book ${bookID} in ${Date.now() - startTime}ms`, { ip: null });
            return book;
        } catch (error) {
            logger.error(`Get receipt book error: ${error.message}`, { ip: null });
            throw error;
        }
    }

    static async getAllReceiptBooks() {
        try {
            const startTime = Date.now();
            // Fetch only essential fields for ReceiptBook
            const books = await ReceiptBook.findAll({
                attributes: ['bookID', 'number', 'type', 'status', 'qrCode', 'agentID', 'currentHolderID'],
                include: [
                    {
                        model: ReceiptStub,
                        attributes: ['stubID', 'status'],
                        required: false,
                    },
                ],
                order: [['number', 'ASC']],
            });

            // Batch fetch associations for visible books
            const bookIDs = books.map(book => book.bookID);
            const [holders, agents, transfers] = await Promise.all([
                User.findAll({
                    where: { userID: books.map(book => book.currentHolderID).filter(id => id) },
                    attributes: ['userID', 'firstname', 'lastname'],
                }),
                Agent.findAll({
                    where: { agentID: books.map(book => book.agentID).filter(id => id) },
                    attributes: ['agentID', 'name', 'lastname'],
                }),
                ReceiptBookTransfer.findAll({
                    where: { bookID: bookIDs },
                    attributes: ['transferID', 'bookID', 'transferType', 'transferDate'],
                }),
            ]);

            // Map associations to books
            const holderMap = new Map(holders.map(h => [h.userID, { ...h.toJSON() }]));
            const agentMap = new Map(agents.map(a => [a.agentID, { ...a.toJSON() }]));
            const transferMap = new Map();
            transfers.forEach(t => {
                if (!transferMap.has(t.bookID)) transferMap.set(t.bookID, []);
                transferMap.get(t.bookID).push({ ...t.toJSON() });
            });

            // Safely serialize books
            const enrichedBooks = books.map(book => {
                // Ensure book is a Sequelize instance or convert safely
                const bookData = book && typeof book.toJSON === 'function' ? book.toJSON() : { ...book };
                bookData.CurrentHolder = book.currentHolderID ? holderMap.get(book.currentHolderID) : null;
                bookData.Agent = book.agentID ? agentMap.get(book.agentID) : null;
                bookData.ReceiptBookTransfers = transferMap.get(book.bookID) || [];
                return bookData;
            });

            logger.info(`Fetched ${enrichedBooks.length} receipt books in ${Date.now() - startTime}ms`, { ip: null });
            return enrichedBooks;
        } catch (error) {
            logger.error(`Get all receipt books error: ${error.message}`, { ip: null });
            const err = new Error('Failed to retrieve receipt books: ' + error.message);
            err.status = 500;
            throw err;
        }
    }

    static async getReceiptBookByNumber(number) {
        try {
            const startTime = Date.now();
            const book = await ReceiptBook.findOne({
                where: { number },
                attributes: ['bookID', 'number', 'type', 'status', 'qrCode', 'agentID', 'currentHolderID'],
                include: [
                    { model: User, as: 'CurrentHolder', attributes: ['userID', 'firstname', 'lastname'] },
                    { model: ReceiptBookTransfer, attributes: ['transferID', 'transferType', 'transferDate'] },
                    { model: Agent, attributes: ['agentID', 'name', 'lastname'] },
                    { model: ReceiptStub, attributes: ['stubID', 'status'] },
                ],
            });
            if (!book) {
                const error = new Error('Receipt book not found');
                error.status = 404;
                throw error;
            }
            logger.info(`Fetched receipt book number ${number} in ${Date.now() - startTime}ms`, { ip: null });
            return book;
        } catch (error) {
            logger.error(`Get receipt book by number error: ${error.message}`, { ip: null });
            throw error;
        }
    }

    static async updateReceiptBook(bookID, updates, userID) {
        try {
            const book = await this.getReceiptBookById(bookID);
            if (book.currentHolderID !== userID) {
                const error = new Error('Only the current holder can update this receipt book');
                error.status = 403;
                throw error;
            }
            const allowedUpdates = ['number', 'type'];
            const updateData = {};
            for (const key of allowedUpdates) {
                if (updates[key] !== undefined) {
                    updateData[key] = updates[key];
                }
            }
            if (updateData.number || updateData.type) {
                updateData.qrCode = await QRGenerator.generateReceiptBookQR(
                    updateData.number || book.number,
                    updateData.type || book.type
                );
            }
            await book.update(updateData);
            logger.info(`Receipt book ${bookID} updated by user ${userID}`, { ip: null });
            return book;
        } catch (error) {
            logger.error(`Update receipt book error: ${error.message}, user: ${userID}`, { ip: null });
            throw error;
        }
    }

    static async deleteReceiptBook(bookID, userID) {
        try {
            const book = await this.getReceiptBookById(bookID);
            if (!['In Stock', 'With Stock Manager'].includes(book.status)) {
                const error = new Error('Receipt book can only be deleted if In Stock or With Stock Manager');
                error.status = 400;
                throw error;
            }
            if (book.currentHolderID !== userID) {
                const error = new Error('Only the current holder can delete this receipt book');
                error.status = 403;
                throw error;
            }
            await Promise.all([
                ReceiptStub.destroy({ where: { bookID } }),
                ReceiptBookTransfer.destroy({ where: { bookID } }),
                book.destroy(),
            ]);
            logger.info(`Receipt book ${bookID} deleted by user ${userID}`, { ip: null });
            return { message: `Receipt Book #${book.number} deleted successfully` };
        } catch (error) {
            logger.error(`Delete receipt book error: ${error.message}, user: ${userID}`, { ip: null });
            throw error;
        }
    }

    static async getReceiptBooksByHolder(holderID, holderType = 'user') {
        try {
            const startTime = Date.now();
            const whereClause = holderType === 'user' ? { currentHolderID: holderID } : { agentID: holderID };
            const books = await ReceiptBook.findAll({
                where: whereClause,
                attributes: ['bookID', 'number', 'type', 'status', 'qrCode', 'agentID', 'currentHolderID'],
                include: [
                    { model: User, as: 'CurrentHolder', attributes: ['userID', 'firstname', 'lastname'] },
                    { model: ReceiptBookTransfer, attributes: ['transferID', 'transferType', 'transferDate'] },
                    { model: Agent, attributes: ['agentID', 'name', 'lastname'] },
                    { model: ReceiptStub, attributes: ['stubID', 'status'] },
                ],
            });
            if (!books.length) {
                const error = new Error(`No receipt books found for this ${holderType}`);
                error.status = 404;
                throw error;
            }
            logger.info(`Fetched receipt books for holder ${holderID} (${holderType}) in ${Date.now() - startTime}ms`, { ip: null });
            return books;
        } catch (error) {
            logger.error(`Get receipt books by holder error: ${error.message}`, { ip: null });
            throw error;
        }
    }

    static async sendToSupplier(bookIDs, supplierEmail, userID) {
        try {
            const books = await ReceiptBook.findAll({ where: { bookID: bookIDs, status: 'In Stock', currentHolderID: userID } });
            if (books.length !== bookIDs.length) {
                const error = new Error('Some books are not in stock or not held by you');
                error.status = 400;
                throw error;
            }

            await Promise.all(
                books.map(async book => {
                    const pendingTransfer = await ReceiptBookTransfer.findOne({
                        where: { bookID: book.bookID, transferType: 'ToSupplier', status: 'Pending' },
                    });
                    if (pendingTransfer) {
                        await pendingTransfer.update({ status: 'Validated', transferDate: new Date() });
                    } else {
                        await this.logTransfer(book.bookID, userID, null, 'Validated', 'ToSupplier');
                    }
                    await book.update({ status: 'Sent to Supplier', currentHolderID: null, supplierSentAt: new Date() });
                })
            );

            const table = books.map(b => `${b.number} | ${b.type}`).join('\n');
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: supplierEmail,
                subject: 'Receipt Books Sent',
                text: `The following receipt books have been sent:\n${table}`,
                attachments: books.map(b => ({
                    filename: `${b.number}.png`,
                    content: b.qrCode,
                    encoding: 'binary',
                })),
            });

            logger.info(`Sent ${bookIDs.length} books to supplier by user ${userID}`, { ip: null });
            return { message: `${books.length} books sent to supplier` };
        } catch (error) {
            logger.error(`Send to supplier error: ${error.message}, user: ${userID}`, { ip: null });
            throw error;
        }
    }

    static async collectFromSupplier(bookIDs, userID) {
        try {
            const books = await ReceiptBook.findAll({ where: { bookID: bookIDs, status: 'Sent to Supplier', currentHolderID: null } });
            if (books.length !== bookIDs.length) {
                const error = new Error('Some books are not in "Sent to Supplier" status or already collected');
                error.status = 400;
                throw error;
            }

            const user = await User.findByPk(userID, { include: [Role] });
            if (!user || !user.Roles.some(r => r.name === 'Purchase Team' || r.name === 'Super Admin')) {
                const error = new Error('Only Purchase Team or Super Admin can collect from supplier');
                error.status = 403;
                throw error;
            }

            await Promise.all(
                books.map(book =>
                    Promise.all([
                        book.update({ status: 'Collect from Supplier', currentHolderID: userID }),
                        this.logTransfer(book.bookID, null, userID, 'Validated', 'FromSupplier'),
                    ])
                )
            );

            logger.info(`Collected ${bookIDs.length} books from supplier by user ${userID}`, { ip: null });
            return { message: `${books.length} books collected from supplier` };
        } catch (error) {
            logger.error(`Collect from supplier error: ${error.message}, user: ${userID}`, { ip: null });
            throw error;
        }
    }

    static async transfer(bookIDs, recipientID, senderID, recipientType = 'user') {
        try {
            const books = await ReceiptBook.findAll({ where: { bookID: bookIDs } });
            if (books.length !== bookIDs.length) {
                const error = new Error('Some books not found');
                error.status = 404;
                throw error;
            }

            const canTransfer = await this.canTransfer(books, senderID);
            if (!canTransfer) {
                const error = new Error('Invalid transfer conditions');
                error.status = 400;
                throw error;
            }

            const recipient = recipientType === 'user'
                ? await User.findByPk(recipientID, { include: [Role] })
                : await Agent.findByPk(recipientID);
            if (!recipient) {
                const error = new Error(`${recipientType === 'user' ? 'User' : 'Agent'} not found`);
                error.status = 404;
                throw error;
            }

            const { transferType } = this.determineTransferDetails(books[0].status, recipientType, recipient);
            if (!transferType) {
                const error = new Error('Invalid transfer type determined');
                error.status = 400;
                throw error;
            }

            const otp = await OTPService.generateOTP(recipientID, recipientType);
            const recipientPhone = recipient.phone || recipient.Agent?.phone;
            const smsResult = await sendSMS(recipientPhone, `Your OTP for receiving ${bookIDs.length} receipt books is ${otp.code}`);

            if (!smsResult.success) {
                logger.warn(`Notification failed for ${recipientType} ${recipientID}: ${smsResult.reason}`, { ip: null });
            }

            await Promise.all(
                books.map(book =>
                    this.logTransfer(book.bookID, senderID, recipientID, 'Pending', transferType, recipientType === 'agent' ? 'toAgentID' : 'toUserID')
                )
            );

            logger.info(`Initiated transfer of ${bookIDs.length} books to ${recipientType} ${recipientID} by user ${senderID}`, { ip: null });
            return { message: `Transfer initiated for ${bookIDs.length} books to ${recipientType} ${recipientID}`, otpID: otp.otpID };
        } catch (error) {
            logger.error(`Transfer error: ${error.message}, user: ${senderID}`, { ip: null });
            throw error;
        }
    }

    static async validateTransfer(bookIDs, recipientID, otpCode, recipientType = 'user') {
        try {
            const transfers = await ReceiptBookTransfer.findAll({
                where: {
                    bookID: bookIDs,
                    [recipientType === 'user' ? 'toUserID' : 'toAgentID']: recipientID,
                    status: 'Pending',
                },
            });
            if (transfers.length !== bookIDs.length) {
                const error = new Error('Invalid or incomplete transfer set');
                error.status = 400;
                throw error;
            }

            await OTPService.validateOTP(recipientID, otpCode, recipientType);

            const recipient = recipientType === 'user'
                ? await User.findByPk(recipientID, { include: [Role] })
                : await Agent.findByPk(recipientID);
            if (!recipient) {
                const error = new Error(`${recipientType} not found`);
                error.status = 404;
                throw error;
            }

            const transferType = transfers[0].transferType;
            const books = await ReceiptBook.findAll({ where: { bookID: bookIDs } });

            await Promise.all(
                books.map(async book => {
                    const { status } = this.determineTransferDetails(book.status, recipientType, recipient);
                    const transfer = transfers.find(t => t.bookID === book.bookID);
                    await Promise.all([
                        book.update({
                            status,
                            currentHolderID: recipientType === 'user' ? recipientID : null,
                            agentID: recipientType === 'agent' ? recipientID : null,
                        }),
                        transfer.update({ status: 'Validated', transferDate: new Date() }),
                    ]);
                })
            );

            const recipientEmail = recipient.email || (await User.findByPk(transfers[0].fromUserID))?.email;
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: recipientEmail,
                subject: `Transfer of ${bookIDs.length} Receipt Books Validated`,
                text: `${bookIDs.length} receipt books transferred to ${recipientType} ${recipientID}.`,
            });

            logger.info(`Validated transfer of ${bookIDs.length} books to ${recipientType} ${recipientID}`, { ip: null });
            return { message: `${bookIDs.length} receipt books transferred and validated` };
        } catch (error) {
            logger.error(`Validate transfer error: ${error.message}`, { ip: null });
            throw error;
        }
    }

    static async getTransferHistory(bookID) {
        try {
            const startTime = Date.now();
            const history = await ReceiptBookTransfer.findAll({
                where: { bookID },
                include: [
                    { model: User, as: 'FromUser', attributes: ['userID', 'firstname', 'lastname'] },
                    { model: User, as: 'ToUser', attributes: ['userID', 'firstname', 'lastname'] },
                    { model: Agent, attributes: ['agentID', 'name', 'lastname'] },
                ],
                order: [['transferDate', 'ASC']],
            });
            logger.info(`Fetched transfer history for book ${bookID} in ${Date.now() - startTime}ms`, { ip: null });
            return history;
        } catch (error) {
            logger.error(`Get transfer history error: ${error.message}`, { ip: null });
            const err = new Error('Failed to retrieve transfer history: ' + error.message);
            err.status = 404;
            throw err;
        }
    }

    static async logTransfer(bookID, fromID, toID, status, transferType, toField = 'toUserID') {
        try {
            const transferData = { bookID, status, transferType };
            if (fromID) transferData.fromUserID = fromID;
            if (toID) transferData[toField] = toID;
            return await ReceiptBookTransfer.create(transferData);
        } catch (error) {
            logger.error(`Log transfer error: ${error.message}`, { ip: null });
            throw new Error('Failed to log transfer: ' + error.message);
        }
    }

    static async canTransfer(books, senderID) {
        try {
            const sender = await User.findByPk(senderID, { include: [Role] });
            const isSuperAdmin = sender?.Roles?.some(r => r.name === 'Super Admin');

            if (isSuperAdmin) {
                logger.info(`Super Admin bypass for senderID: ${senderID}`, { ip: null });
                return true;
            }

            return books.every(book =>
                (book.status === 'In Stock' && book.currentHolderID === senderID) ||
                (book.status === 'Sent to Supplier' && !book.currentHolderID) ||
                (book.status === 'Collect from Supplier' && book.currentHolderID === senderID) ||
                (['With Regional Manager', 'With Supervisor', 'Stub Collected'].includes(book.status) && book.currentHolderID === senderID)
            );
        } catch (error) {
            logger.error(`Can transfer check error: ${error.message}, user: ${senderID}`, { ip: null });
            throw error;
        }
    }

    static determineTransferDetails(currentStatus, recipientType, recipient) {
        try {
            logger.debug(`Determine transfer details: status=${currentStatus}, recipientType=${recipientType}`, { ip: null });

            if (recipientType === 'agent') {
                return { status: 'Assigned to Agent', transferType: 'ToAgent' };
            }

            const role = recipient.Roles?.length ? recipient.Roles[0].name : 'Unknown';
            logger.debug(`Determined role: ${role} for recipientID: ${recipient.userID || recipient.agentID}`, { ip: null });

            const statusMap = {
                'In Stock': 'Sent to Supplier',
                'Sent to Supplier': 'Collect from Supplier',
                'Collect from Supplier': 'With Regional Manager',
                'With Regional Manager': {
                    Supervisor: 'With Supervisor',
                    'Regional Manager': 'With Regional Manager',
                    'Stock Manager': 'With Stock Manager',
                },
                'With Supervisor': {
                    Supervisor: 'With Supervisor',
                    'Regional Manager': 'With Regional Manager',
                    'Stock Manager': 'With Stock Manager',
                },
                'Stub Collected': {
                    'Regional Manager': 'With Regional Manager',
                    'Stock Manager': 'With Stock Manager',
                },
                'With Stock Manager': {
                    'Stock Manager': 'With Stock Manager',
                },
            };

            const transferTypeMap = {
                'Regional Manager': 'ToRegionalManager',
                Supervisor: 'ToSupervisor',
                'Stock Manager': 'ToStockManager',
            };

            let newStatus;
            if (statusMap[currentStatus]) {
                if (typeof statusMap[currentStatus] === 'object') {
                    newStatus = statusMap[currentStatus][role] || currentStatus;
                } else {
                    newStatus = statusMap[currentStatus];
                }
            } else {
                newStatus = currentStatus;
            }

            const transferType = transferTypeMap[role] || 'Unknown';
            if (
                ![
                    'ToSupplier',
                    'ToRegionalManager',
                    'ToSupervisor',
                    'ToAgent',
                    'StubToSupervisor',
                    'ToRegionalManagerFromSupervisor',
                    'ToStockManager',
                    'Archived',
                    'FromSupplier',
                ].includes(transferType)
            ) {
                logger.error(`Invalid transferType: ${transferType} for role: ${role}`, { ip: null });
                throw new Error(`Invalid transferType: ${transferType}`);
            }

            logger.debug(`Determined: status=${newStatus}, transferType=${transferType}`, { ip: null });
            return { status: newStatus, transferType };
        } catch (error) {
            logger.error(`Determine transfer details error: ${error.message}`, { ip: null });
            throw new Error('Failed to determine transfer details: ' + error.message);
        }
    }
}

module.exports = ReceiptBookService;