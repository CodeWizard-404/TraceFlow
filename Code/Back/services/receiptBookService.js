const { sendSMS } = require('../config/sms');
const { sendEmail } = require('../config/smtp');
const { ReceiptBook, User, Agent, ReceiptBookTransfer, ReceiptStub, Role, ReceiptBookType, sequelize } = require('../models');
const OTPService = require('../services/otpService');
const QRGenerator = require('../utils/qrGenerator');
const csv = require('csv-parse');
const { Readable } = require('stream');
const { Op } = require('sequelize');
const iconv = require('iconv-lite');
const CsvHeader = require('../models').CsvHeader;
const archiver = require('archiver');
const { stringify } = require('csv-stringify');
const pendingTransfers = new Map();
const fs = require('fs').promises;
const path = require('path');
const { getRedisClient } = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

class ReceiptBookService {
    // --- Type Management Methods ---
    static async createReceiptBookType(name) {
        try {
            const type = await ReceiptBookType.create({ name });
            return type;
        } catch (error) {
            const err = new Error('Failed to create receipt book type: ' + error.message);
            err.status = 400;
            throw err;
        }
    }

    static async getAllReceiptBookTypes() {
        try {
            const types = await ReceiptBookType.findAll({
                attributes: ['typeID', 'name'],
                order: [['name', 'ASC']],
            });
            return await Promise.all(types.map(type => type.toJSON()));
        } catch (error) {
            const err = new Error('Failed to retrieve receipt book types: ' + error.message);
            err.status = 500;
            throw err;
        }
    }

    static async getReceiptBookTypeById(typeID) {
        try {
            const type = await ReceiptBookType.findByPk(typeID);
            if (!type) {
                const error = new Error('Receipt book type not found');
                error.status = 404;
                throw error;
            }
            return type;
        } catch (error) {
            throw error;
        }
    }

    static async updateReceiptBookType(typeID, name) {
        try {
            const type = await this.getReceiptBookTypeById(typeID);
            await type.update({ name });
            return type;
        } catch (error) {
            throw error;
        }
    }

    static async deleteReceiptBookType(typeID) {
        try {
            const type = await this.getReceiptBookTypeById(typeID);
            const bookCount = await ReceiptBook.count({ where: { typeID } });
            if (bookCount > 0) {
                const error = new Error('Cannot delete type with associated receipt books');
                error.status = 400;
                throw error;
            }
            await type.destroy();
            return { message: `Receipt book type ${type.name} deleted successfully` };
        } catch (error) {
            throw error;
        }
    }

    // --- Receipt Book Methods ---
    static async createReceiptBook(number, typeID, purchaseUserID, options = {}) {
        try {
            const type = await ReceiptBookType.findByPk(typeID, options);
            if (!type) {
                const error = new Error('Invalid receipt book type');
                error.status = 400;
                throw error;
            }
            const qrCode = await QRGenerator.generateReceiptBookQR(number, type.name);
            const book = await ReceiptBook.create(
                {
                    number,
                    typeID,
                    qrCode,
                    status: 'In Stock',
                    currentHolderID: purchaseUserID,
                },
                options
            );

            await ReceiptStub.create({ bookID: book.bookID, status: 'pending' }, options);
            await this.logTransfer(book.bookID, purchaseUserID, null, 'Pending', 'ToSupplier', 'toUserID', options);

            return book;
        } catch (error) {
            const err = new Error('Failed to create receipt book: ' + error.message);
            err.status = 400;
            throw err;
        }
    }

    static async getReceiptBookById(bookID) {
        try {
            const startTime = Date.now();
            const book = await ReceiptBook.findByPk(bookID, {
                attributes: ['bookID', 'number', 'status', 'qrCode', 'agentID', 'currentHolderID', 'typeID'],
                include: [
                    {
                        model: User,
                        as: 'CurrentHolder',
                        attributes: ['userID', 'firstname', 'lastname', 'phone'],
                    },
                    {
                        model: ReceiptBookTransfer,
                        attributes: ['transferID', 'transferType', 'transferDate'],
                        include: [],
                    },
                    {
                        model: Agent,
                        attributes: ['agentID', 'name', 'lastname'],
                    },
                    {
                        model: ReceiptStub,
                        attributes: ['stubID', 'status'],
                    },
                    {
                        model: ReceiptBookType,
                        attributes: ['typeID', 'name'],
                    },
                ],
            });
            if (!book) {
                const error = new Error('Receipt book not found');
                error.status = 404;
                throw error;
            }

            // Transform the response to include holder details directly
            const bookData = book.toJSON();
            bookData.holder = bookData.CurrentHolder
                ? {
                    userID: bookData.CurrentHolder.userID,
                    firstname: bookData.CurrentHolder.firstname,
                    lastname: bookData.CurrentHolder.lastname,
                    phone: bookData.CurrentHolder.phone,
                }
                : null;
            delete bookData.CurrentHolder;

            return bookData;
        } catch (error) {
            throw error;
        }
    }

    static async getAllReceiptBooks(
        page = 1,
        limit = 10,
        sortField = 'number',
        sortOrder = 'ASC',
        searchQuery = '',
        filterType = 'all',
        filterStatus = 'all'
    ) {
        const traceId = uuidv4();
        const startTime = Date.now();
        try {

            // Build where clause for filtering
            const whereClause = {};
            if (searchQuery) {
                whereClause[Op.or] = [
                    { number: { [Op.iLike]: `%${searchQuery}%` } }, // Use iLike for case-insensitive search
                    { '$ReceiptBookType.name$': { [Op.iLike]: `%${searchQuery}%` } },
                    sequelize.where(sequelize.cast(sequelize.col('ReceiptBook.status'), 'TEXT'), {
                        [Op.iLike]: `%${searchQuery}%`
                    }), // Cast ENUM to TEXT for LIKE search
                    { '$CurrentHolder.firstname$': { [Op.iLike]: `%${searchQuery}%` } },
                    { '$CurrentHolder.lastname$': { [Op.iLike]: `%${searchQuery}%` } },
                    { '$Agent.name$': { [Op.iLike]: `%${searchQuery}%` } },
                    { '$Agent.lastname$': { [Op.iLike]: `%${searchQuery}%` } },
                ];
                // Handle ReceiptStub.status separately due to optional association
                if (searchQuery) {
                    whereClause[Op.or].push(
                        sequelize.where(
                            sequelize.cast(sequelize.col('ReceiptStub.status'), 'TEXT'),
                            { [Op.iLike]: `%${searchQuery}%` }
                        )
                    );
                }
            }
            if (filterType !== 'all') {
                whereClause.typeID = filterType;
            }
            if (filterStatus !== 'all') {
                whereClause.status = filterStatus;
            }


            // Pagination
            const offset = (page - 1) * limit;

            // Define sorting logic based on sortField
            let orderClause;
            switch (sortField) {
                case 'number':
                    orderClause = [[sequelize.literal("CAST(regexp_replace(number, '\\D', '', 'g') AS INTEGER)"), sortOrder]];
                    break;
                case 'holder':
                    orderClause = [
                        [{ model: User, as: 'CurrentHolder' }, 'lastname', sortOrder],
                        [{ model: User, as: 'CurrentHolder' }, 'firstname', sortOrder],
                    ];
                    break;
                case 'bookStatus':
                    orderClause = [['status', sortOrder]];
                    break;
                case 'stubStatus':
                    orderClause = [[{ model: ReceiptStub, as: 'ReceiptStub' }, 'status', sortOrder]];
                    break;
                case 'type':
                    orderClause = [[{ model: ReceiptBookType, as: 'ReceiptBookType' }, 'name', sortOrder]];
                    break;
                default:
                    throw new Error(`Invalid sortField: ${sortField}`);
            }

            // Fetch receipt books with pagination and sorting
            const books = await ReceiptBook.findAll({
                where: whereClause,
                attributes: ['bookID', 'number', 'status', 'qrCode', 'agentID', 'currentHolderID', 'typeID'],
                include: [
                    {
                        model: User,
                        as: 'CurrentHolder',
                        attributes: ['userID', 'firstname', 'lastname', 'phone'],
                        required: false, // Allow null CurrentHolder
                    },
                    {
                        model: Agent,
                        attributes: ['agentID', 'name', 'lastname'],
                        required: false, // Allow null Agent
                    },
                    {
                        model: ReceiptStub,
                        as: 'ReceiptStub',
                        attributes: ['stubID', 'status'],
                        required: false, // Allow null ReceiptStub
                    },
                    {
                        model: ReceiptBookType,
                        as: 'ReceiptBookType',
                        attributes: ['typeID', 'name'],
                        required: false, // Allow null ReceiptBookType
                    },
                ],
                order: orderClause,
                offset,
                limit,
            });


            // Transform the response
            const enrichedBooks = books.map(book => {
                const bookData = book.toJSON();
                bookData.holder = bookData.CurrentHolder ? {
                    userID: bookData.CurrentHolder.userID,
                    firstname: bookData.CurrentHolder.firstname,
                    lastname: bookData.CurrentHolder.lastname,
                    phone: bookData.CurrentHolder.phone,
                } : null;
                bookData.Agent = bookData.Agent ? {
                    agentID: bookData.Agent.agentID,
                    name: bookData.Agent.name,
                    lastname: bookData.Agent.lastname,
                } : null;
                bookData.type = bookData.ReceiptBookType ? bookData.ReceiptBookType.name : null;
                bookData.ReceiptStub = bookData.ReceiptStub || null;
                delete bookData.CurrentHolder;
                delete bookData.ReceiptBookType;
                return bookData;
            });


            // Get total count for pagination
            const countStartTime = Date.now();
            const totalCount = await ReceiptBook.count({
                where: whereClause,
                include: [
                    { model: User, as: 'CurrentHolder', required: false },
                    { model: Agent, required: false },
                    { model: ReceiptStub, as: 'ReceiptStub', required: false },
                    { model: ReceiptBookType, as: 'ReceiptBookType', required: false },
                ],
            });


            const result = {
                books: enrichedBooks,
                totalCount,
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
            };


            return result;
        } catch (error) {
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
                attributes: ['bookID', 'number', 'status', 'qrCode', 'agentID', 'currentHolderID', 'typeID'],
                include: [
                    {
                        model: User,
                        as: 'CurrentHolder',
                        attributes: ['userID', 'firstname', 'lastname', 'phone'],
                    },
                    {
                        model: ReceiptBookTransfer,
                        attributes: ['transferID', 'transferType', 'transferDate'],
                    },
                    {
                        model: Agent,
                        attributes: ['agentID', 'name', 'lastname'],
                    },
                    {
                        model: ReceiptStub,
                        attributes: ['stubID', 'status'],
                    },
                    {
                        model: ReceiptBookType,
                        attributes: ['typeID', 'name'],
                    },
                ],
            });
            if (!book) {
                const error = new Error('Receipt book not found');
                error.status = 404;
                throw error;
            }
            const bookData = book.toJSON();
            bookData.holder = bookData.CurrentHolder
                ? {
                    userID: bookData.CurrentHolder.userID,
                    firstname: bookData.CurrentHolder.firstname,
                    lastname: bookData.CurrentHolder.lastname,
                    phone: bookData.CurrentHolder.phone,
                }
                : null;
            bookData.type = bookData.ReceiptBookType ? bookData.ReceiptBookType.name : null;
            delete bookData.ReceiptBookType;
            delete bookData.CurrentHolder;
            return bookData;
        } catch (error) {
            throw error;
        }
    }

    static async updateReceiptBook(bookID, updates, userID) {
        try {
            const book = await this.getReceiptBookById(bookID);
            if (book.currentHolderID !== userID) {
                const error = new Error('Only the current holder can update this receipt book');
                error.ascertainable = true;
                error.status = 403;
                throw error;
            }
            const allowedUpdates = ['number', 'typeID'];
            const updateData = {};
            for (const key of allowedUpdates) {
                if (updates[key] !== undefined) {
                    updateData[key] = updates[key];
                }
            }
            if (updateData.typeID) {
                const type = await ReceiptBookType.findByPk(updateData.typeID);
                if (!type) {
                    const error = new Error('Invalid receipt book type');
                    error.status = 400;
                    throw error;
                }
                updateData.qrCode = await QRGenerator.generateReceiptBookQR(
                    updateData.number || book.number,
                    type.name
                );
            } else if (updateData.number) {
                updateData.qrCode = await QRGenerator.generateReceiptBookQR(
                    updateData.number,
                    book.ReceiptBookType.name
                );
            }
            await book.update(updateData);
            return book;
        } catch (error) {
            throw error;
        }
    }

    static async deleteReceiptBook(bookID, userID) {
        try {
            // Fetch book details for validation using getReceiptBookById
            const bookData = await this.getReceiptBookById(bookID);
            if (!['In Stock', 'With Stock Manager'].includes(bookData.status)) {
                const error = new Error('Receipt book can only be deleted if In Stock or With Stock Manager');
                error.status = 400;
                throw error;
            }

            // Fetch the Sequelize model instance for deletion
            const book = await ReceiptBook.findByPk(bookID);
            if (!book) {
                const error = new Error('Receipt book not found');
                error.status = 404;
                throw error;
            }

            await Promise.all([
                ReceiptStub.destroy({ where: { bookID } }),
                ReceiptBookTransfer.destroy({ where: { bookID } }),
                book.destroy(),
            ]);

            return { message: `Receipt Book #${bookData.number} deleted successfully` };
        } catch (error) {
            throw error;
        }
    }

    static async getReceiptBooksByHolder(holderID, holderType = 'user') {
        try {
            const startTime = Date.now();
            const whereClause = holderType === 'user' ? { currentHolderID: holderID } : { agentID: holderID };
            const books = await ReceiptBook.findAll({
                where: whereClause,
                attributes: ['bookID', 'number', 'status', 'qrCode', 'agentID', 'currentHolderID', 'typeID'],
                include: [
                    {
                        model: User,
                        as: 'CurrentHolder',
                        attributes: ['userID', 'firstname', 'lastname', 'phone'],
                    },
                    {
                        model: ReceiptBookTransfer,
                        attributes: ['transferID', 'transferType', 'transferDate'],
                    },
                    {
                        model: Agent,
                        attributes: ['agentID', 'name', 'lastname'],
                    },
                    {
                        model: ReceiptStub,
                        attributes: ['stubID', 'status'],
                    },
                    {
                        model: ReceiptBookType,
                        attributes: ['typeID', 'name'],
                    },
                ],
            });
            if (!books.length) {
                const error = new Error(`No receipt books found for this ${holderType}`);
                error.status = 404;
                throw error;
            }
            return books.map(book => {
                const bookData = book.toJSON();
                bookData.holder = bookData.CurrentHolder
                    ? {
                        userID: bookData.CurrentHolder.userID,
                        firstname: bookData.CurrentHolder.firstname,
                        lastname: bookData.CurrentHolder.lastname,
                        phone: bookData.CurrentHolder.phone,
                    }
                    : null;
                bookData.type = bookData.ReceiptBookType ? bookData.ReceiptBookType.name : null;
                delete bookData.ReceiptBookType;
                delete bookData.CurrentHolder;
                return bookData;
            });
        } catch (error) {
            throw error;
        }
    }

    // --- Receipt Book Transfer ---
    static async sendToSupplier(transferID, bookIDs, supplierEmail, isPartial, userID) {
        try {
            if (isPartial) {
                // Partial request handling (unchanged)
                const books = await ReceiptBook.findAll({
                    where: { bookID: bookIDs, status: 'In Stock', currentHolderID: userID },
                    include: [{ model: ReceiptBookType, attributes: ['name'] }],
                });
                if (books.length !== bookIDs.length) {
                    const error = new Error('Some books are not in stock or not held by you');
                    error.status = 400;
                    throw error;
                }

                const bookDetails = books.map(b => ({
                    number: b.number,
                    type: b.ReceiptBookType.name,
                    qrCode: b.qrCode,
                }));

                if (!pendingTransfers.has(transferID)) {
                    pendingTransfers.set(transferID, { supplierEmail, books: [] });
                }
                pendingTransfers.get(transferID).books.push(...bookDetails);

                const transaction = await ReceiptBook.sequelize.transaction();
                try {
                    await Promise.all(
                        books.map(async book => {
                            const pendingTransfer = await ReceiptBookTransfer.findOne({
                                where: { bookID: book.bookID, transferType: 'ToSupplier', status: 'Pending' },
                                transaction,
                            });
                            if (pendingTransfer) {
                                await pendingTransfer.update({ status: 'Validated', transferDate: new Date() }, { transaction });
                            } else {
                                await this.logTransfer(book.bookID, userID, null, 'Validated', 'ToSupplier', null, { transaction });
                            }
                            await book.update(
                                { status: 'Sent to Supplier', currentHolderID: null, supplierSentAt: new Date() },
                                { transaction }
                            );
                        })
                    );
                    await transaction.commit();
                } catch (error) {
                    await transaction.rollback();
                    throw error;
                }

                return { message: `${books.length} books processed` };
            } else {
                // Final request: save files and send email with token-based links
                const transfer = pendingTransfers.get(transferID);
                if (!transfer || transfer.supplierEmail !== supplierEmail) {
                    const error = new Error('Invalid transfer ID or supplier email');
                    error.status = 400;
                    throw error;
                }
                const bookDetails = transfer.books;
                if (bookDetails.length === 0) {
                    const error = new Error('No books to send');
                    error.status = 400;
                    throw error;
                }

                // Generate CSV content
                const csvData = bookDetails.map(b => ({ number: b.number, type: b.type }));
                const csvContent = await new Promise((resolve, reject) => {
                    stringify(csvData, { header: true, columns: ['number', 'type'] }, (err, output) => {
                        if (err) reject(err);
                        else resolve(output);
                    });
                });

                // Generate ZIP buffer
                const archive = archiver('zip', { zlib: { level: 9 } });
                const zipBuffers = [];
                archive.on('data', chunk => zipBuffers.push(chunk));
                archive.on('error', err => { throw err; });
                bookDetails.forEach(b => {
                    archive.append(b.qrCode, { name: `${b.number}.png` });
                });
                archive.finalize();
                const zipBuffer = await new Promise((resolve, reject) => {
                    archive.on('end', () => resolve(Buffer.concat(zipBuffers)));
                    archive.on('error', reject);
                });

                // Ensure the upload directory exists
                const uploadDir = path.join(__dirname, '..', 'Uploads', 'supplier_files');
                await fs.mkdir(uploadDir, { recursive: true });

                // Save CSV and ZIP files
                const csvFileName = `${transferID}_books.csv`;
                const csvFilePath = path.join(uploadDir, csvFileName);
                await fs.writeFile(csvFilePath, csvContent);

                const zipFileName = `${transferID}_qrcodes.zip`;
                const zipFilePath = path.join(uploadDir, zipFileName);
                await fs.writeFile(zipFilePath, zipBuffer);

                // Generate tokens and store in Redis without initial expiration
                const redisClient = getRedisClient();
                const csvToken = uuidv4();
                const zipToken = uuidv4();
                const maxDownloads = process.env.MAX_FILE_DOWNLOADS || 5;

                await redisClient.hset(`file:${csvToken}`, {
                    filePath: csvFilePath,
                    fileName: csvFileName,
                    downloadCount: 0,
                    maxDownloads,
                });

                await redisClient.hset(`file:${zipToken}`, {
                    filePath: zipFilePath,
                    fileName: zipFileName,
                    downloadCount: 0,
                    maxDownloads,
                });

                // Generate URLs with tokens
                const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
                const csvUrl = `${baseUrl}/api/uploads/supplier_files/${csvFileName}?token=${csvToken}`;
                const zipUrl = `${baseUrl}/api/uploads/supplier_files/${zipFileName}?token=${zipToken}`;

                // Generate preview table (first 10 books)
                const previewBooks = bookDetails.slice(0, 10);
                const receiptBooksTable = `
          <table>
            <thead>
              <tr><th>Book Number</th><th>Type</th></tr>
            </thead>
            <tbody>
              ${previewBooks.map(b => `<tr><td>${b.number}</td><td>${b.type}</td></tr>`).join('')}
            </tbody>
          </table>
        `;
                const bookTypes = Object.entries(
                    bookDetails.reduce((acc, b) => {
                        acc[b.type] = (acc[b.type] || 0) + 1;
                        return acc;
                    }, {})
                ).map(([type, count]) => `${type} (${count})`).join(', ');

                // Send email with token-based links
                await sendEmail({
                    to: supplierEmail,
                    subject: 'Receipt Books Sent for Printing',
                    templateName: 'supplier_receipt_books',
                    replacements: {
                        supplierName: 'Supplier',
                        totalBooks: bookDetails.length,
                        bookTypes,
                        receiptBooksTable,
                        csvUrl,
                        zipUrl,
                        supportEmail: process.env.SUPPORT_EMAIL || 'support@traceflow.example.com',
                        maxDownloads,
                    },
                    textFallback: `The following receipt books have been sent for printing (${bookDetails.length} total). You can download the list and QR codes from the following links (available indefinitely until downloaded, then expire 7 days after first download, limited to ${maxDownloads} downloads each):\nCSV: ${csvUrl}\nZIP: ${zipUrl}`,
                });

                // Clean up pendingTransfers
                pendingTransfers.delete(transferID);
                return { message: `${bookDetails.length} books sent to supplier`, csvUrl, zipUrl };
            }
        } catch (error) {
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
            if (!user || !user.Roles.some(r => r.name === process.env.PURCHASE_TEAM || r.name === process.env.SUPER_ADMIN)) {
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

            return { message: `${books.length} books collected from supplier` };
        } catch (error) {
            throw error;
        }
    }

    static async transfer(bookIDs, recipientID, senderID, recipientType = 'user') {
        try {
            const books = await ReceiptBook.findAll({
                where: { bookID: bookIDs },
                include: [{ model: ReceiptBookType, attributes: ['name'] }],
            });
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
            await sendSMS(recipientPhone, `Your OTP for receiving ${bookIDs.length} receipt books is ${otp.code}`);

            await Promise.all(
                books.map(book =>
                    this.logTransfer(book.bookID, senderID, recipientID, 'Pending', transferType, recipientType === 'agent' ? 'toAgentID' : 'toUserID')
                )
            );

            return { message: `Transfer initiated for ${bookIDs.length} books to ${recipientType} ${recipientID}`, otpID: otp.otpID };
        } catch (error) {
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

            return { message: `${bookIDs.length} receipt books transferred and validated` };
        } catch (error) {
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
            return history;
        } catch (error) {
            const err = new Error('Failed to retrieve transfer history: ' + error.message);
            err.status = 404;
            throw err;
        }
    }

    static async logTransfer(bookID, fromID, toID, status, transferType, toField = 'toUserID', options = {}) {
        try {
            const transferData = { bookID, status, transferType };
            if (fromID) transferData.fromUserID = fromID;
            if (toID) transferData[toField] = toID;
            return await ReceiptBookTransfer.create(transferData, options);
        } catch (error) {
            throw new Error('Failed to log transfer: ' + error.message);
        }
    }

    static async canTransfer(books, senderID) {
        try {
            const sender = await User.findByPk(senderID, { include: [Role] });
            const isSuperAdmin = sender?.Roles?.some(r => r.name === process.env.ROLE_SUPER_ADMIN);

            if (isSuperAdmin) {
                return true;
            }

            return books.every(book =>
                (book.status === 'In Stock' && book.currentHolderID === senderID) ||
                (book.status === 'Sent to Supplier' && !book.currentHolderID) ||
                (book.status === 'Collect from Supplier' && book.currentHolderID === senderID) ||
                (['With Regional Manager', 'With Supervisor', 'Stub Collected'].includes(book.status) && book.currentHolderID === senderID)
            );
        } catch (error) {
            throw error;
        }
    }

    static determineTransferDetails(currentStatus, recipientType, recipient) {
        try {
            if (recipientType === 'agent') {
                return { status: 'Assigned to Agent', transferType: 'ToAgent' };
            }

            const role = recipient.Roles?.length ? recipient.Roles[0].name : 'Unknown';

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
                throw new Error(`Invalid transferType: ${transferType}`);
            }

            return { status: newStatus, transferType };
        } catch (error) {
            throw new Error('Failed to determine transfer details: ' + error.message);
        }
    }

    /**
     * Process receipt book CSV file.
     * @param {Buffer} fileBuffer - Uploaded CSV file buffer.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Detailed processing results.
     */
    static async processReceiptBookCSV(fileBuffer, actorID) {
        const results = {
            status: 'pending',
            summary: {
                totalRecords: 0,
                booksCreated: 0,
                recordsSkipped: 0,
                errorsEncountered: 0,
            },
            detailedLog: {
                created: [],
                skipped: [],
                errors: [],
            },
        };

        // Decode buffer with fallback encoding
        let bufferString;
        try {
            bufferString = fileBuffer.toString(process.env.CSV_ENCODING || 'utf8');
            if (bufferString.includes('\uFFFD')) {
                bufferString = iconv.decode(fileBuffer, process.env.CSV_FALLBACK_ENCODING || 'win1252');
            }
        } catch (error) {
            try {
                bufferString = iconv.decode(fileBuffer, process.env.CSV_FALLBACK_ENCODING || 'win1252');
            } catch (fallbackError) {
                results.detailedLog.errors.push({
                    bookNumber: 'N/A',
                    bookType: 'N/A',
                    timestamp: new Date().toISOString(),
                    operation: 'CSV parsing',
                    reason: `Failed to decode buffer: ${fallbackError.message}`,
                });
                results.summary.errorsEncountered++;
                return results;
            }
        }

        // Fetch header mappings
        const headerMappings = await CsvHeader.findAll({ where: { csvType: 'receipt_book' } });
        const headerMap = headerMappings.reduce((map, header) => {
            map[header.mappedHeader] = header.expectedHeader;
            return map;
        }, {});

        // Extract and validate CSV headers
        const firstLine = bufferString.split('\n')[0].trim();
        if (!firstLine) {
            results.detailedLog.errors.push({
                bookNumber: 'N/A',
                bookType: 'N/A',
                timestamp: new Date().toISOString(),
                operation: 'CSV parsing',
                reason: 'CSV file is empty or has no headers',
            });
            results.summary.errorsEncountered++;
            return results;
        }
        const csvHeaders = firstLine.split(',').map(h => h.trim()).filter(h => h);

        // Validate mandatory headers
        const mandatoryHeaders = ['number', 'type'];
        const missingMandatory = mandatoryHeaders.filter(h => {
            const mapping = headerMappings.find(m => m.expectedHeader === h);
            return !mapping || !csvHeaders.includes(mapping.mappedHeader);
        });
        if (missingMandatory.length > 0) {
            results.detailedLog.errors.push({
                bookNumber: 'N/A',
                bookType: 'N/A',
                timestamp: new Date().toISOString(),
                operation: 'Header validation',
                reason: `Missing required headers: ${missingMandatory.join(', ')}`,
            });
            results.summary.errorsEncountered++;
            return results;
        }

        // Parse CSV with dynamic column mapping
        const parser = Readable.from(bufferString).pipe(
            csv.parse({
                columns: header => header.map(h => headerMap[h] || h),
                skip_empty_lines: true,
                trim: true,
                bom: true,
                delimiter: process.env.CSV_DELIMITER || ',',
                quote: process.env.CSV_QUOTE || '"',
            })
        );

        for await (const record of parser) {
            results.summary.totalRecords++;
            const { number, type } = record;

            // Validate required fields
            if (!number || !type) {
                results.detailedLog.skipped.push({
                    bookNumber: number || 'N/A',
                    bookType: type || 'N/A',
                    timestamp: new Date().toISOString(),
                    reason: `Missing required fields: ${!number ? 'number' : ''} ${!type ? 'type' : ''}`.trim(),
                });
                results.summary.recordsSkipped++;
                continue;
            }

            const transaction = await ReceiptBook.sequelize.transaction();
            try {
                // Validate book number format (example: alphanumeric, 1-50 characters)
                if (!/^[a-zA-Z0-9]{1,50}$/.test(number)) {
                    results.detailedLog.skipped.push({
                        bookNumber: number,
                        bookType: type,
                        timestamp: new Date().toISOString(),
                        reason: 'Invalid book number format: must be 1-50 alphanumeric characters',
                    });
                    results.summary.recordsSkipped++;
                    await transaction.rollback();
                    continue;
                }

                // Check for duplicate book number
                const existingBook = await ReceiptBook.findOne({ where: { number }, transaction });
                if (existingBook) {
                    results.detailedLog.skipped.push({
                        bookNumber: number,
                        bookType: type,
                        timestamp: new Date().toISOString(),
                        reason: `Book number '${number}' already exists`,
                    });
                    results.summary.recordsSkipped++;
                    await transaction.rollback();
                    continue;
                }

                // Find or create receipt book type
                let bookType = await ReceiptBookType.findOne({
                    where: { name: { [Op.iLike]: type } },
                    transaction,
                });
                if (!bookType) {
                    bookType = await ReceiptBookType.create(
                        { name: type },
                        { transaction }
                    );
                }

                // Create receipt book
                const book = await this.createReceiptBook(number, bookType.typeID, actorID, { transaction });

                results.detailedLog.created.push({
                    bookNumber: number,
                    bookType: type,
                    timestamp: new Date().toISOString(),
                    details: `Receipt book created with number '${number}' and type '${type}'`,
                });
                results.summary.booksCreated++;

                await transaction.commit();
            } catch (error) {
                await transaction.rollback();
                results.detailedLog.errors.push({
                    bookNumber: number || 'N/A',
                    bookType: type || 'N/A',
                    timestamp: new Date().toISOString(),
                    operation: 'Record processing',
                    reason: `Failed to process record: ${error.message}`,
                });
                results.summary.errorsEncountered++;
            }
        }

        // Determine overall status
        results.status =
            results.summary.errorsEncountered === 0 && results.summary.recordsSkipped === 0
                ? 'completed_successfully'
                : results.summary.booksCreated > 0
                    ? 'completed_with_issues'
                    : 'failed';

        return results;
    }
}

module.exports = ReceiptBookService;