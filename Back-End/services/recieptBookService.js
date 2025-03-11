const { ReceiptBook, ReceiptStub, User, Agent, OTP } = require('../models');
const { Op } = require('sequelize');
const QRCode = require('qrcode');
const { nanoid } = require('nanoid');

const receiptBookService = {
    // US 63: Generate unique QR codes for receipt books
    async generateQRCode(bookDetails) {
        const { number, type } = bookDetails;
        const qrData = `book_${nanoid()}_${number}_${type}`;
        const qrCode = await QRCode.toDataURL(qrData); // Returns base64 string
        return { qrData, qrCode };
    },

    // US 64: Record initial stock of receipt books
    async recordInitialStock(purchaseUserID, bookDetails) {
        const { number, type } = bookDetails;
        const { qrData, qrCode } = await this.generateQRCode(bookDetails);

        const receiptBook = await ReceiptBook.create({
            number,
            type,
            status: 'in_stock',
            qrCode: qrData,
            ownerID: purchaseUserID, // Purchase team member owns initially
        });

        return receiptBook;
    },

    // US 65: Share QR codes with suppliers (mocked for now)
    async shareQRWithSuppliers(bookID) {
        const book = await ReceiptBook.findByPk(bookID);
        if (!book) throw new Error('Receipt book not found');
        // Mock: In reality, this would send QR code via email/SMS to suppliers
        return { bookID, qrCode: book.qrCode };
    },

    // US 66: Regional Manager receives receipt books
    async receiveReceiptBook(regionalManagerID, qrCode) {
        const book = await ReceiptBook.findOne({ where: { qrCode } });
        if (!book) throw new Error('Receipt book not found');
        if (book.status !== 'in_stock') throw new Error('Book not available');

        book.status = 'received';
        book.ownerID = regionalManagerID;
        await book.save();

        return book;
    },

    // US 67 & 16: Distribute receipt books to Supervisors with OTP
    async distributeToSupervisor(regionalManagerID, supervisorID, qrCode, otpCode) {
        const book = await ReceiptBook.findOne({ where: { qrCode } });
        if (!book || book.ownerID !== regionalManagerID) throw new Error('Invalid book or permission');

        const otp = await OTP.findOne({
            where: { userID: supervisorID, code: otpCode, expiresAt: { [Op.gt]: new Date() } },
        });
        if (!otp) throw new Error('Invalid or expired OTP');

        book.ownerID = supervisorID;
        book.status = 'distributed';
        await book.save();

        await otp.destroy(); // OTP used, delete it
        return book;
    },

    // US 17: Assign receipt books to Payment Agents
    async assignToAgent(supervisorID, agentID, qrCode, otpCode, portfolioNumber) {
        const book = await ReceiptBook.findOne({ where: { qrCode, ownerID: supervisorID } });
        if (!book) throw new Error('Invalid book or permission');

        const otp = await OTP.findOne({
            where: { userID: supervisorID, code: otpCode, expiresAt: { [Op.gt]: new Date() } },
        });
        if (!otp) throw new Error('Invalid or expired OTP');

        book.agentID = agentID;
        book.status = 'assigned';
        await book.save();

        await Agent.update({ wallet: portfolioNumber }, { where: { agentID } });
        await otp.destroy();

        return book;
    },

    // US 18: Collect stubs from Payment Agents
    async collectStub(supervisorID, qrCode, otpCode) {
        const book = await ReceiptBook.findOne({ where: { qrCode, ownerID: supervisorID } });
        if (!book) throw new Error('Invalid book or permission');

        const otp = await OTP.findOne({
            where: { userID: supervisorID, code: otpCode, expiresAt: { [Op.gt]: new Date() } },
        });
        if (!otp) throw new Error('Invalid or expired OTP');

        const stub = await ReceiptStub.findOne({ where: { bookID: book.bookID } });
        if (!stub) {
            await ReceiptStub.create({ bookID: book.bookID, status: 'collected' });
        } else {
            stub.status = 'collected';
            await stub.save();
        }

        await otp.destroy();
        return stub;
    },

    // US 19: Transmit stubs to Regional Managers
    async transmitStub(supervisorID, regionalManagerID, qrCode) {
        const book = await ReceiptBook.findOne({ where: { qrCode, ownerID: supervisorID } });
        if (!book) throw new Error('Invalid book or permission');

        const stub = await ReceiptStub.findOne({ where: { bookID: book.bookID } });
        if (!stub || stub.status !== 'collected') throw new Error('Stub not collected yet');

        stub.status = 'transmitted';
        book.ownerID = regionalManagerID;
        await Promise.all([stub.save(), book.save()]);

        return stub;
    },
};

module.exports = receiptBookService;