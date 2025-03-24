const QRCode = require('qrcode');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const { ReceiptBook, User, Agent, OTP, ReceiptBookTransfer, ReceiptStub, Role } = require('../models');
const OTPService = require('../services/otpService');

class ReceiptBookService {
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

    static async getReceiptBookById(bookID) {
        const book = await ReceiptBook.findByPk(bookID, {
            include: [{ model: User, as: 'CurrentHolder' }, { model: ReceiptBookTransfer }, { model: Agent }, { model: ReceiptStub }],
        });
        if (!book) throw new Error('Receipt book not found');
        return book;
    }

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

    static async transfer(bookIDs, recipientID, senderID, recipientType = 'user') {
        const books = await ReceiptBook.findAll({ where: { bookID: bookIDs } });
        if (books.length !== bookIDs.length) throw new Error('Some books not found');

        const canTransfer = await this.canTransfer(books, senderID);
        if (!canTransfer) throw new Error('Invalid transfer conditions');

        const recipient = recipientType === 'user'
            ? await User.findByPk(recipientID, { include: [Role] })
            : await Agent.findOne({ where: { agentID: recipientID } });
        if (!recipient) throw new Error(`${recipientType === 'user' ? 'User' : 'Agent'} not found`);

        const { transferType } = this.determineTransferDetails(books[0].status, recipientType, recipient);
        if (!transferType) throw new Error('Invalid transfer type determined');

        const otp = await OTPService.generateOTP(recipientID, recipientType);
        const recipientPhone = recipient.phone || recipient.Agent?.phone;
        const smsResult = await sendSMS(recipientPhone, `Your OTP for receiving ${bookIDs.length} books is ${otp.code}`);

        if (!smsResult.success) {
            console.warn(`${new Date().toISOString()} - Notification failed for ${recipientType} ${recipientID}: ${smsResult.reason}`);
        }

        await Promise.all(books.map(book =>
            this.logTransfer(book.bookID, senderID, recipientID, 'Pending', transferType, recipientType === 'agent' ? 'toAgentID' : 'toUserID')
        ));

        return { message: `Transfer initiated for ${recipientType} ${recipientID}`, otpID: otp.otpID };
    }

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

        const recipient = recipientType === 'user'
            ? await User.findByPk(recipientID, { include: [Role] })
            : await Agent.findByPk(recipientID);
        if (!recipient) throw new Error(`${recipientType} not found`);

        const transferType = transfers[0].transferType;
        const book = await ReceiptBook.findByPk(transfers[0].bookID);
        const { status } = this.determineTransferDetails(book.status, recipientType, recipient);

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

    static async collectFromSupplier(bookIDs, userID) {
        const books = await ReceiptBook.findAll({ where: { bookID: bookIDs, status: 'Sent to Supplier', currentHolderID: null } });
        if (books.length !== bookIDs.length) throw new Error('Some books are not in "Sent to Supplier" status or already collected');

        const user = await User.findByPk(userID, { include: [Role] });
        if (!user || !user.Roles.some(r => r.name === 'Purchase Team' || r.name === 'Super Admin')) {
            throw new Error('Only Purchase Team or Super Admin can collect from supplier');
        }

        await Promise.all(books.map(book =>
            Promise.all([
                book.update({ status: 'In Stock', currentHolderID: userID }),
                this.logTransfer(book.bookID, null, userID, 'Validated', 'FromSupplier')
            ])
        ));

        return { message: `${books.length} books collected from supplier` };
    }

    static async getTransferHistory(bookID) {
        return await ReceiptBookTransfer.findAll({
            where: { bookID },
            include: [{ model: User, as: 'FromUser' }, { model: User, as: 'ToUser' }, { model: Agent }],
            order: [['transferDate', 'ASC']],
        });
    }

    static async logTransfer(bookID, fromID, toID, status, transferType, toField = 'toUserID') {
        const transferData = { bookID, status, transferType };
        if (fromID) transferData.fromUserID = fromID;
        if (toID) transferData[toField] = toID;
        return await ReceiptBookTransfer.create(transferData);
    }

    static async canTransfer(books, senderID) {
        const sender = await User.findByPk(senderID, { include: [Role] });
        const isSuperAdmin = sender?.Roles?.some(r => r.name === 'Super Admin');

        if (isSuperAdmin) {
            console.log(`${new Date().toISOString()} - Super Admin bypass for senderID: ${senderID}`);
            return true;
        }

        return books.every(book =>
            (book.status === 'In Stock' && book.currentHolderID === senderID) ||
            (book.status === 'Sent to Supplier' && !book.currentHolderID) ||
            (['With Regional Manager', 'With Supervisor', 'Stub Collected'].includes(book.status) && book.currentHolderID === senderID)
        );
    }

    static determineTransferDetails(currentStatus, recipientType, recipient) {
        console.log(`${new Date().toISOString()} - determineTransferDetails inputs:`, { currentStatus, recipientType, recipient: JSON.stringify(recipient) });

        if (recipientType === 'agent') {
            return { status: 'Assigned to Agent', transferType: 'ToAgent' };
        }

        const role = recipient.Roles?.length ? recipient.Roles[0].name : 'Unknown';
        console.log(`${new Date().toISOString()} - Determined role: ${role} for recipientID: ${recipient.userID || recipient.agentID}`);

        const statusMap = {
            'In Stock': 'Sent to Supplier',
            'Sent to Supplier': 'With Regional Manager',
            'With Regional Manager': {
                'Supervisor': 'With Supervisor',
                'Regional Manager': 'With Regional Manager',
                'Stock Manager': 'With Stock Manager',
            },
            'With Supervisor': {
                'Supervisor': 'With Supervisor',
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
            'Supervisor': 'ToSupervisor',
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
        if (!['ToSupplier', 'ToRegionalManager', 'ToSupervisor', 'ToAgent', 'StubToSupervisor', 'ToRegionalManagerFromSupervisor', 'ToStockManager', 'Archived', 'FromSupplier'].includes(transferType)) {
            console.error(`${new Date().toISOString()} - Invalid transferType: ${transferType} for role: ${role}`);
            throw new Error(`Invalid transferType: ${transferType}`);
        }

        console.log(`${new Date().toISOString()} - Determined:`, { status: newStatus, transferType });
        return { status: newStatus, transferType };
    }

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
        const allowedUpdates = ['number', 'type'];
        const updateData = {};
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                updateData[key] = updates[key];
            }
        }
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