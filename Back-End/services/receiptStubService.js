const { ReceiptStub, ReceiptBook, Agent, OTP, User } = require('../models');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const { Op } = require('sequelize');

class ReceiptStubService {
    static async collectStub(bookID) {
        const book = await ReceiptBook.findByPk(bookID, { include: [Agent] });
        if (!book || !book.agentID) throw new Error('ReceiptBook not assigned to an Agent');

        const stub = await ReceiptStub.findOne({ where: { bookID } }) || await ReceiptStub.create({ bookID });
        if (stub.status === 'collected') throw new Error('Stub already collected');

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await OTP.create({ code: otpCode, expiresAt, userID: book.agentID });

        await sendSMS(book.Agent.phone, `Your OTP to confirm stub collection for Receipt Book #${book.number} is ${otpCode}`);

        return { message: 'OTP sent to Agent' };
    }

    static async validateStubCollection(bookID, supervisorID, otpCode) {
        const book = await ReceiptBook.findByPk(bookID, { include: [Agent] });
        if (!book || !book.agentID) throw new Error('ReceiptBook not assigned to an Agent');

        const otp = await OTP.findOne({
            where: { userID: book.agentID, code: otpCode, expiresAt: { [Op.gt]: new Date() } },
        });
        if (!otp) throw new Error('Invalid or expired OTP');

        const stub = await ReceiptStub.findOne({ where: { bookID } });
        await stub.update({ status: 'collected' });
        await book.update({ status: 'Stub Collected', agentID: null });
        await book.setUsers([supervisorID]); // Supervisor becomes the owner
        await otp.destroy();

        const supervisor = await User.findByPk(supervisorID);
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: supervisor.email,
            subject: `Stub Collected for Receipt Book #${book.number}`,
            text: `Stub for Receipt Book #${book.number} has been collected.`,
        });

        return stub;
    }

    static async transmitStub(bookID, newOwnerID) {
        const book = await ReceiptBook.findByPk(bookID, { include: [{ model: User, as: 'Users' }] });
        const stub = await ReceiptStub.findOne({ where: { bookID } });
        if (!stub || stub.status !== 'collected') throw new Error('Stub not collected yet');

        const newOwner = await User.findByPk(newOwnerID);
        if (!newOwner) throw new Error('User not found');

        await book.setUsers([newOwnerID]); // Transfer ownership
        await book.update({ status: 'With Regional Manager' });

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: newOwner.email,
            subject: `Stub Transmitted for Receipt Book #${book.number}`,
            text: `Stub for Receipt Book #${book.number} has been transmitted to you.`,
        });

        return stub;
    }
}

module.exports = ReceiptStubService;