const QRCode = require('qrcode');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const { ReceiptBook, User, Agent, OTP, ReceiptBookTransfer, ReceiptStub } = require('../models');
const OTPService = require('../services/otpService');

class ReceiptBookService {


    // Create a new receipt book with stub
    static async createReceiptBook(number, type, purchaseUserID) {
        const tlvData = [
            this.formatTLV('01', (number || number).toString()),
            this.formatTLV('02', type || type),
        ].join('');
        const qrCode = await QRCode.toDataURL(tlvData);
        const book = await ReceiptBook.create({ number, type, qrCode, status: 'In Stock', currentHolderID: purchaseUserID });
        await ReceiptStub.create({ bookID: book.bookID, status: 'pending' });
        await this.logTransfer(book.bookID, purchaseUserID, null, 'Pending', 'ToSupplier');
        return book;
    }

    // Get receipt book by ID with associations
    static async getReceiptBookById(bookID) {
        const book = await ReceiptBook.findByPk(bookID, {
            include: [{ model: User, as: 'CurrentHolder' }, { model: ReceiptBookTransfer }, { model: Agent }, { model: ReceiptStub }],
        });
        if (!book) throw new Error('Receipt book not found');
        return book;
    }

    // Send multiple books to supplier
    static async sendToSupplier(bookIDs, supplierEmail, userID) {
        const books = await ReceiptBook.findAll({ where: { bookID: bookIDs, status: 'In Stock', currentHolderID: userID } });
        if (books.length !== bookIDs.length) throw new Error('Some books are not in stock or not held by you');

        await Promise.all(books.map(book =>
            Promise.all([
                book.update({ status: 'Sent to Supplier', currentHolderID: null, supplierSentAt: new Date() }),
                this.logTransfer(book.bookID, userID, null, 'Validated', 'ToSupplier'),
            ])
        ));

        const table = books.map(b => `${b.number} | ${b.type}`).join('\n');
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: supplierEmail,
            subject: 'Receipt Books Sent',
            text: `The following receipt books have been sent:\n${table}`,
            attachments: books.map(b => ({ filename: `${b.number}.png`, content: b.qrCode.split("base64,")[1], encoding: 'base64' })),
        });

        return { message: `${books.length} books sent to supplier` };
    }

    // Get transfer history
    static async getTransferHistory(bookID) {
        return await ReceiptBookTransfer.findAll({
            where: { bookID },
            include: [{ model: User, as: 'FromUser' }, { model: User, as: 'ToUser' }, { model: Agent }],
            order: [['transferDate', 'ASC']],
        });
    }

    // Generic transfer method for users or agents
    static async transfer(bookIDs, recipientID, senderID, recipientType = 'user') {
        const books = await ReceiptBook.findAll({ where: { bookID: bookIDs } });
        if (books.length !== bookIDs.length) throw new Error('Some books not found');
        if (!this.canTransfer(books, senderID)) throw new Error('Invalid transfer conditions');

        const recipient = recipientType === 'user' ? await User.findByPk(recipientID) : await Agent.findOne({ where: { agentID: recipientID } });
        if (!recipient) throw new Error(`${recipientType === 'user' ? 'User' : 'Agent'} not found`);

        const { transferType } = this.determineTransferDetails(books[0].status, recipientType, recipient);
        const otp = await OTPService.generateOTP(recipientID, recipientType);
        const recipientPhone = recipient.phone || recipient.Agent?.phone;
        await sendSMS(recipientPhone, `Your OTP for receiving ${bookIDs.length} books is ${otp.code}`);

        await Promise.all(books.map(book =>
            this.logTransfer(book.bookID, senderID, recipientID, 'Pending', transferType, recipientType === 'agent' ? 'toAgentID' : 'toUserID')
        ));

        return { message: `OTP sent to ${recipientType} ${recipientID}`, otpID: otp.otpID };
    }

    // Validate transfer with OTP
    static async validateTransfer(bookIDs, recipientID, otpCode, recipientType = 'user') {
        const transfers = await ReceiptBookTransfer.findAll({
            where: { 
                bookID: bookIDs, 
                [recipientType === 'user' ? 'toUserID' : 'toAgentID']: recipientID, 
                status: 'Pending' 
            },
        });
        if (transfers.length !== bookIDs.length) throw new Error('Invalid or incomplete transfer set');

        await OTPService.validateOTP(recipientID, otpCode, recipientType);

        const recipient = recipientType === 'user' ? await User.findByPk(recipientID) : await Agent.findByPk(recipientID);
        const { status } = this.determineTransferDetails(transfers[0].bookID, recipientType, recipient);

        await Promise.all(transfers.map(async t => {
            const book = await ReceiptBook.findByPk(t.bookID);
            await Promise.all([
                book.update({ 
                    status, 
                    currentHolderID: recipientType === 'user' ? recipientID : null, 
                    agentID: recipientType === 'agent' ? recipientID : null 
                }),
                t.update({ status: 'Validated' }),
            ]);
        }));

        const recipientEmail = recipient.email || (await User.findByPk(transfers[0].fromUserID))?.email;
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: recipientEmail,
            subject: `Transfer of ${bookIDs.length} Books Validated`,
            text: `${bookIDs.length} books transferred to ${recipientType} ${recipientID}. New status: ${status}`,
        });

        return { message: `${bookIDs.length} books transferred and validated` };
    }

    // Helper: Log transfer
    static async logTransfer(bookID, fromID, toID, status, transferType, toField = 'toUserID') {
        const transferData = { bookID, status, transferType };
        if (fromID) transferData.fromUserID = fromID;
        if (toID) transferData[toField] = toID;
        return await ReceiptBookTransfer.create(transferData);
    }

    // Helper: Check if transfer is valid
    static canTransfer(books, senderID) {
        return books.every(book => 
            (book.status === 'In Stock' && book.currentHolderID === senderID) ||
            (book.status === 'Sent to Supplier' && !book.currentHolderID) ||
            (['With Regional Manager', 'With Supervisor', 'Stub Collected'].includes(book.status) && book.currentHolderID === senderID)
        );
    }

    // Helper: Determine status and transfer type
static determineTransferDetails(currentStatus, recipientType, recipient) {
    if (recipientType === 'agent') {
        return { status: 'Assigned to Agent', transferType: 'ToAgent' };
    }

    const role = recipient.Roles?.length ? recipient.Roles[0].name : 'Unknown';

    // Map current status to new status based on recipient role
    const statusMap = {
        'In Stock': 'Sent to Supplier',
        'Sent to Supplier': 'With Regional Manager',
        'With Regional Manager': {
            'Supervisor': 'With Supervisor',
            'Regional Manager': 'With Regional Manager', // Same-role transfer
        },
        'With Supervisor': {
            'Supervisor': 'With Supervisor', // Same-role transfer
            'Regional Manager': 'With Regional Manager', // Return to Regional Manager
            'Stock Manager': 'With Stock Manager', // Rare case, but possible
        },
        'Stub Collected': {
            'Regional Manager': 'With Regional Manager',
            'Stock Manager': 'With Stock Manager',
        },
        'With Stock Manager': {
            'Stock Manager': 'With Stock Manager', // Same-role transfer
        },
    };

    const transferTypeMap = {
        'Regional Manager': 'ToRegionalManager',
        'Supervisor': 'ToSupervisor',
        'Stock Manager': 'ToStockManager',
    };

    // Determine new status based on current status and recipient role
    let newStatus;
    if (statusMap[currentStatus]) {
        if (typeof statusMap[currentStatus] === 'object') {
            newStatus = statusMap[currentStatus][role] || currentStatus; // Fallback to current if role not mapped
        } else {
            newStatus = statusMap[currentStatus];
        }
    } else {
        newStatus = currentStatus; // Default to no change if status not mapped
    }

    const transferType = transferTypeMap[role];
    return { status: newStatus, transferType };
}

    // helper: Format TLV data
    static formatTLV(tag, value) {
        const length = value.length.toString().padStart(2, '0');
        return `${tag}${length}${value}`;
    }



    static async getAllReceiptBooks() {
        return await ReceiptBook.findAll({
            include: [{ model: User, as: 'CurrentHolder' }, { model: ReceiptBookTransfer }, { model: Agent }, { model: ReceiptStub }],
        });
    }

    static async updateReceiptBook(bookID, updates) {
        const book = await this.getReceiptBookById(bookID);

        // Restrict which fields can be updated
        const allowedUpdates = ['number', 'type'];
        const updateData = {};
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                updateData[key] = updates[key];
            }
        }

        // If number or type changes, regenerate QR code
        if (updateData.number || updateData.type) {
            const tlvData = [
                this.formatTLV('01', (updateData.number || book.number).toString()),
                this.formatTLV('02', updateData.type || book.type),
            ].join('');
            updateData.qrCode = await QRCode.toDataURL(tlvData);
        }

        await book.update(updateData);
        return book;
    }

    static async deleteReceiptBook(bookID, userID) {
        const book = await this.getReceiptBookById(bookID);

        // Only allow deletion if the book is in 'In Stock' or 'With Stock Manager' status
        if (!['In Stock', 'With Stock Manager'].includes(book.status)) {
            throw new Error('Receipt book can only be deleted if In Stock or With Stock Manager');
        }

        if (book.currentHolderID !== userID) {
            throw new Error('Only the current holder can delete this receipt book');
        }

        await Promise.all([
            ReceiptStub.destroy({ where: { bookID } }),
            ReceiptBookTransfer.destroy({ where: { bookID } }),
            book.destroy(),
        ]);

        return { message: `Receipt Book #${book.number} deleted successfully` };
    }






}

module.exports = ReceiptBookService;