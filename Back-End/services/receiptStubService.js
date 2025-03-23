const { ReceiptBook, Agent, ReceiptStub, ReceiptBookTransfer } = require('../models');
const OTPService = require('./otpService');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');

class ReceiptStubService {
    // Collect stub from agent
    static async collectStub(bookID) {
        const book = await ReceiptBook.findByPk(bookID, { include: [Agent, ReceiptStub] });
        if (book.status !== 'Assigned to Agent' || !book.agentID) throw new Error('Book not assigned to an agent');
        if (book.ReceiptStub.status !== 'pending') throw new Error('Stub already processed');

        const otp = await OTPService.generateOTP(book.agentID, 'agent');
        await sendSMS(book.Agent.phone, `Your OTP for stub collection of Book #${book.number} is ${otp.code}`);

        return { message: 'OTP sent to agent' };
    }

    // Validate stub collection
    static async validateStubCollection(bookID, supervisorID, otpCode) {
        const book = await ReceiptBook.findByPk(bookID, { include: [Agent, ReceiptStub] });
        if (book.status !== 'Assigned to Agent' || !book.agentID) throw new Error('Invalid book state');

        await OTPService.validateOTP(book.agentID, otpCode, 'agent');

        await Promise.all([
            book.update({ status: 'Stub Collected', agentID: null, currentHolderID: supervisorID }),
            book.ReceiptStub.update({ status: 'collected' }),
            ReceiptBookTransfer.create({ bookID, fromAgentID: book.agentID, toUserID: supervisorID, status: 'Validated', transferType: 'StubToSupervisor' }),
        ]);

        return { message: 'Stub collected' };
    }

    // Archive stub
    static async archiveStub(bookID, stockManagerID) {
        const book = await ReceiptBook.findByPk(bookID, { include: [ReceiptStub] });
        if (book.currentHolderID !== stockManagerID) throw new Error('Only the stock manager can archive');
        if (book.status !== 'With Stock Manager') throw new Error('Book must be with stock manager');
        if (book.ReceiptStub.status === 'archived') throw new Error('Stub already archived');

        await Promise.all([
            book.update({ status: 'Archived' }),
            book.ReceiptStub.update({ status: 'archived' }),
            ReceiptBookTransfer.create({ bookID, fromUserID: stockManagerID, toUserID: stockManagerID, status: 'Validated', transferType: 'Archived' }),
        ]);

        return { message: 'Stub archived' };
    }
}

module.exports = ReceiptStubService;