const { ReceiptBook, Agent, User, ReceiptStub, ReceiptBookTransfer } = require('../models');
const OTPService = require('./otpService');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const logger = require('../utils/logger');

class ReceiptStubService {
    static async collectStub(bookID, userID) {
        try {
            const book = await ReceiptBook.findByPk(bookID, { include: [Agent, ReceiptStub] });
            if (!book) {
                const error = new Error('Receipt book not found');
                error.status = 404;
                throw error;
            }
            if (book.status !== 'Assigned to Agent' || !book.agentID) {
                const error = new Error('Book not assigned to an agent');
                error.status = 400;
                throw error;
            }
            if (book.ReceiptStub.status !== 'pending') {
                const error = new Error('Stub already processed');
                error.status = 400;
                throw error;
            }

            const otp = await OTPService.generateOTP(book.agentID, 'agent');
            const smsResult = await sendSMS(book.Agent.phone, `Your OTP for stub collection of Book #${book.number} is ${otp.code}`);
            if (!smsResult.success) {
                logger.warn(`SMS notification failed for agent ${book.agentID}: ${smsResult.reason}`, { ip: null });
            }

            logger.info(`Initiated stub collection for book ${bookID} by user ${userID}`, { ip: null });
            return { message: 'OTP sent to agent' };
        } catch (error) {
            logger.error(`Collect stub error: ${error.message}, user: ${userID}`, { ip: null });
            throw error;
        }
    }

    static async validateStubCollection(bookID, supervisorID, otpCode) {
        try {
            const book = await ReceiptBook.findByPk(bookID, { include: [Agent, ReceiptStub] });
            if (!book) {
                const error = new Error('Receipt book not found');
                error.status = 404;
                throw error;
            }
            if (book.status !== 'Assigned to Agent' || !book.agentID) {
                const error = new Error('Invalid book state');
                error.status = 400;
                throw error;
            }
            if (book.ReceiptStub.status !== 'pending') {
                const error = new Error('Stub already processed');
                error.status = 400;
                throw error;
            }

            await OTPService.validateOTP(book.agentID, otpCode, 'agent');

            await Promise.all([
                book.update({ status: 'Stub Collected', agentID: null, currentHolderID: supervisorID }),
                book.ReceiptStub.update({ status: 'collected' }),
                ReceiptBookTransfer.create({
                    bookID,
                    fromAgentID: book.agentID,
                    toUserID: supervisorID,
                    status: 'Validated',
                    transferType: 'StubToSupervisor',
                }),
            ]);

            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: book.Agent.email || (await User.findByPk(supervisorID))?.email,
                subject: `Stub Collection Validated for Book #${book.number}`,
                text: `Stub for Book #${book.number} has been collected by Supervisor ${supervisorID}.`,
            });

            logger.info(`Validated stub collection for book ${bookID} by user ${supervisorID}`, { ip: null });
            return { message: 'Stub collected' };
        } catch (error) {
            logger.error(`Validate stub collection error: ${error.message}, user: ${supervisorID}`, { ip: null });
            throw error;
        }
    }

    static async archiveStub(bookID, stockManagerID) {
        try {
            const book = await ReceiptBook.findByPk(bookID, { include: [ReceiptStub] });
            if (!book) {
                const error = new Error('Receipt book not found');
                error.status = 404;
                throw error;
            }
            if (book.currentHolderID !== stockManagerID) {
                const error = new Error('Only the stock manager can archive');
                error.status = 403;
                throw error;
            }
            if (book.status !== 'With Stock Manager') {
                const error = new Error('Book must be with stock manager');
                error.status = 400;
                throw error;
            }
            if (book.ReceiptStub.status === 'archived') {
                const error = new Error('Stub already archived');
                error.status = 400;
                throw error;
            }

            await Promise.all([
                book.update({ status: 'Archived' }),
                book.ReceiptStub.update({ status: 'archived' }),
                ReceiptBookTransfer.create({
                    bookID,
                    fromUserID: stockManagerID,
                    toUserID: stockManagerID,
                    status: 'Validated',
                    transferType: 'Archived',
                }),
            ]);

            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: (await User.findByPk(stockManagerID))?.email,
                subject: `Stub Archived for Book #${book.number}`,
                text: `Stub for Book #${book.number} has been archived by Stock Manager ${stockManagerID}.`,
            });

            logger.info(`Archived stub for book ${bookID} by user ${stockManagerID}`, { ip: null });
            return { message: 'Stub archived' };
        } catch (error) {
            logger.error(`Archive stub error: ${error.message}, user: ${stockManagerID}`, { ip: null });
            throw error;
        }
    }
}

module.exports = ReceiptStubService;