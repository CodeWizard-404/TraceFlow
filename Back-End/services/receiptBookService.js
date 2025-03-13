const { ReceiptBook, User, Agent, OTP } = require('../models');
const QRCode = require('qrcode');
const { transporter } = require('../config/smtp');
const { sendSMS } = require('../config/sms'); // Use your axios-based SMS
const { Op } = require('sequelize');

class ReceiptBookService {
    // Create receipt book with QR code (User Stories 63, 64)
    static async createReceiptBook(number, type) {
        const qrCode = await QRCode.toDataURL(`book_${number}_${Date.now()}`);
        const receiptBook = await ReceiptBook.create({
            number,
            type,
            qrCode,
            status: 'In Stock',
        });
        return receiptBook;
    }

    // Get all receipt books (User Story 64 - Inventory)
    static async getAllReceiptBooks() {
        return await ReceiptBook.findAll({
            include: [{ model: User, as: 'Users' }, { model: Agent }],
        });
    }

    // Get receipt book by ID
    static async getReceiptBookById(bookID) {
        const book = await ReceiptBook.findByPk(bookID, {
            include: [{ model: User, as: 'Users' }, { model: Agent }],
        });
        if (!book) throw new Error('ReceiptBook not found');
        return book;
    }

    // Transfer receipt book between Users (User Stories 66, 67, 16)
    static async transferReceiptBookToUser(bookID, newOwnerID) {
        const book = await this.getReceiptBookById(bookID);
        const newOwner = await User.findByPk(newOwnerID);
        if (!newOwner) throw new Error('User not found');

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await OTP.create({ code: otpCode, expiresAt, userID: newOwnerID });

        await sendSMS(newOwner.phone, `Your OTP to receive Receipt Book #${book.number} is ${otpCode}`);

        return { message: `OTP sent to user ${newOwnerID}` };
    }

    // Validate transfer to User
    static async validateTransferToUser(bookID, newOwnerID, otpCode) {
        const otp = await OTP.findOne({
            where: { userID: newOwnerID, code: otpCode, expiresAt: { [Op.gt]: new Date() } },
        });
        if (!otp) throw new Error('Invalid or expired OTP');

        const book = await this.getReceiptBookById(bookID);
        const statusMap = {
            'In Stock': 'With Regional Manager',
            'With Regional Manager': 'With Supervisor',
        };
        const newStatus = statusMap[book.status] || book.status;

        // Update ownership via the many-to-many relationship
        await book.setUsers([newOwnerID]); // Replace all current owners with newOwnerID
        await book.update({ status: newStatus });
        await otp.destroy();

        // Notify via email
        const newOwner = await User.findByPk(newOwnerID);
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: newOwner.email,
            subject: `Receipt Book #${book.number} Transferred`,
            text: `You are now an owner of Receipt Book #${book.number}. Status: ${newStatus}`,
        });

        return book;
    }

    // Assign to Agent (User Story 17)
    static async assignToAgent(bookID, agentPhone) {
        const book = await this.getReceiptBookById(bookID);
        if (book.status !== 'With Supervisor') throw new Error('Book must be with Supervisor');

        const agent = await Agent.findOne({ where: { phone: agentPhone } });
        if (!agent) throw new Error('Agent not found');

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await OTP.create({ code: otpCode, expiresAt, userID: agent.agentID });

        await sendSMS(agentPhone, `Your OTP to receive Receipt Book #${book.number} is ${otpCode}`);

        return { message: 'OTP sent to Agent' };
    }

    // Validate assignment to Agent
    static async validateAgentAssignment(bookID, agentPhone, otpCode) {
        const agent = await Agent.findOne({ where: { phone: agentPhone } });
        if (!agent) throw new Error('Agent not found');

        const otp = await OTP.findOne({
            where: { userID: agent.agentID, code: otpCode, expiresAt: { [Op.gt]: new Date() } },
        });
        if (!otp) throw new Error('Invalid or expired OTP');

        const book = await this.getReceiptBookById(bookID);
        await book.update({ agentID: agent.agentID, status: 'Assigned to Agent' });
        await otp.destroy();

        // Notify supervisor(s) via email
        const supervisors = await book.getUsers(); // Get all current owners
        for (const supervisor of supervisors) {
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: supervisor.email,
                subject: `Receipt Book #${book.number} Assigned`,
                text: `Receipt Book #${book.number} has been assigned to Agent with phone ${agentPhone}.`,
            });
        }

        return book;
    }
}

module.exports = ReceiptBookService;