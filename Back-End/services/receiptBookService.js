const QRCode = require('qrcode');
const { Op } = require('sequelize');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const { ReceiptBook, User, Agent, OTP, ReceiptBookTransfer, ReceiptStub } = require('../models');
const OTPService = require('../services/otpService');

class ReceiptBookService {
    static async createReceiptBook(number, type, purchaseUserID) {
        const tlvData = [
            this.formatTLV('01', number.toString()),
            this.formatTLV('02', type),
        ].join('');
        const qrCode = await QRCode.toDataURL(tlvData);

        const receiptBook = await ReceiptBook.create({
            number,
            type,
            qrCode,
            status: 'In Stock',
            currentHolderID: purchaseUserID,
        });

        // Create the stub at the same time as the book
        await ReceiptStub.create({
            bookID: receiptBook.bookID,
            status: 'pending',
        });

        await ReceiptBookTransfer.create({
            bookID: receiptBook.bookID,
            fromUserID: purchaseUserID,
            status: 'In Stock',
        });

        return receiptBook;
    }

    // Send Book To Supplier Email
    static async sendBookToSupplier(bookID, supplierEmail, userID) {
        const book = await this.getReceiptBookById(bookID);
        if (book.status !== 'In Stock') throw new Error('Book must be in stock');

        await book.update({ status: 'Sent to Supplier', currentHolderID: null });
        await ReceiptBookTransfer.create({
            bookID,
            fromUserID: userID,
            status: 'Sent to Supplier',
        });

        const user = await User.findByPk(userID);

        // Notify via email
        await transporter.sendMail({
            from: user.email,
            to: supplierEmail,
            subject: `Receipt Book #${book.number} Assignment Notification`,
            text: `Receipt Book #${book.number}. Below are the details of the receipt book:

                    - Number: ${book.number}
                    - Type: ${book.type}

                    Please find the QR code attached for your reference.

                    Thank you for your cooperation.

                    Best regards,
                    [Your Company Name]`,
                            attachments: [
                                {
                                    filename: 'qrcode.png',
                                    content: book.qrCode.split("base64,")[1],
                                    encoding: 'base64',
                                },
                            ],
                        });

        return book;
    }

    static async transferToUser(bookID, newOwnerID) {
        const book = await ReceiptBook.findByPk(bookID);
        const newOwner = await User.findByPk(newOwnerID);
        if (!newOwner) throw new Error('User not found');

        const otp = await OTPService.generateOTP(newOwnerID);
        await sendSMS(newOwner.phone, `Your OTP to receive Receipt Book #${book.number} is ${otp.code}`);

        return { message: `OTP sent to user ${newOwnerID}` };
    }

    static async validateTransferToUser(bookID, newOwnerID, otpCode) {
        const book = await this.getReceiptBookById(bookID);
        const newOwner = await User.findByPk(newOwnerID);
        if (!newOwner) throw new Error('User not found');

        await OTPService.validateOTP(newOwnerID, otpCode);

        const newOwnerRole = await newOwner.getRoles();
        const roleName = newOwnerRole.length > 0 ? newOwnerRole[0].name : 'Unknown';

        let newStatus;
        switch (roleName) {
            case 'Regional Manager':
                newStatus = 'With Regional Manager';
                break;
            case 'Supervisor':
                newStatus = 'With Supervisor';
                break;
            case 'Stock Manager':
                newStatus = 'With Stock Manager';
                break;
            default:
                const statusMap = {
                    'In Stock': 'With Regional Manager',
                    'Sent to Supplier': 'With Regional Manager',
                    'With Regional Manager': 'With Supervisor',
                    'With Supervisor': 'With Supervisor',
                    'Stub Collected': 'With Regional Manager',
                    'With Regional Manager': 'With Stock Manager',
                    'With Supervisor': 'With Stock Manager',
                };
                newStatus = statusMap[book.status] || book.status;
        }

        const previousHolderID = book.currentHolderID;

        await Promise.all([
            book.setUsers([newOwnerID]),
            book.update({ status: newStatus, currentHolderID: newOwnerID }),
            ReceiptBookTransfer.create({
                bookID,
                fromUserID: previousHolderID,
                toUserID: newOwnerID,
                status: newStatus,
            }),
        ]);

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: newOwner.email,
            subject: `Receipt Book #${book.number} Transferred`,
            text: `You are now the holder of Receipt Book #${book.number}. Status: ${newStatus}`,
        });

        return book;
    }

    static async assignToAgent(bookID, agentPhone, supervisorID) {
        const book = await this.getReceiptBookById(bookID);
        if (book.status !== 'With Supervisor') throw new Error('Book must be with Supervisor');
        if (book.currentHolderID !== supervisorID) {
            throw new Error('Only the current supervisor can assign to an agent');
        }

        const agent = await Agent.findOne({ where: { phone: agentPhone } });
        if (!agent) throw new Error('Agent not found');

        const otp = await OTPService.generateOTP(agent.agentID);
        await sendSMS(agentPhone, `Your OTP to receive Receipt Book #${book.number} is ${otp.code}`);

        return { message: `OTP sent to Agent with phone ${agentPhone}` };
    }

    static async validateAgentAssignment(bookID, agentPhone, otpCode, supervisorID) {
        const book = await this.getReceiptBookById(bookID);
        if (book.currentHolderID !== supervisorID) {
            throw new Error('Only the current supervisor can validate assignment');
        }

        const agent = await Agent.findOne({ where: { phone: agentPhone } });
        if (!agent) throw new Error('Agent not found');

        await OTPService.validateOTP(agent.agentID, otpCode);

        await Promise.all([
            book.update({ agentID: agent.agentID, status: 'Assigned to Agent', currentHolderID: null }),
            ReceiptBookTransfer.create({
                bookID,
                fromUserID: supervisorID,
                toAgentID: agent.agentID,
                status: 'Assigned to Agent',
            }),
        ]);

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: (await User.findByPk(supervisorID)).email,
            subject: `Receipt Book #${book.number} Assigned`,
            text: `Receipt Book #${book.number} assigned to Agent with phone ${agentPhone}.`,
        });

        return book;
    }

    static async getTransferHistory(bookID) {
        return await ReceiptBookTransfer.findAll({
            where: { bookID },
            include: [
                { model: User, as: 'FromUser' },
                { model: User, as: 'ToUser' },
                { model: Agent },
            ],
            order: [['transferDate', 'ASC']],
        });
    }

    static async getReceiptBookById(bookID) {
        const book = await ReceiptBook.findByPk(bookID, {
            include: [{ model: User, as: 'CurrentHolder' },{ model: ReceiptBookTransfer},  { model: Agent }, { model: ReceiptStub }],
        });
        if (!book) throw new Error('ReceiptBook not found');
        return book;
    }

    static async getAllReceiptBooks() {
        return await ReceiptBook.findAll({
            include: [{ model: User, as: 'CurrentHolder' },{ model: ReceiptBookTransfer},  { model: Agent }, { model: ReceiptStub }],
        });
    }

    static formatTLV(tag, value) {
        const length = value.length.toString().padStart(2, '0');
        return `${tag}${length}${value}`;
    }
}

module.exports = ReceiptBookService;