const { ReceiptBook, Agent, User, ReceiptStub, ReceiptBookTransfer } = require('../models');
const OTPService = require('./otpService');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const logger = require('../utils/logger');

class ReceiptStubService {
    static async collectStub(bookIDs, userID) {
        try {
            const books = await ReceiptBook.findAll({
                where: { bookID: bookIDs },
                include: [Agent, ReceiptStub]
            });
            if (books.length !== bookIDs.length) {
                const error = new Error('Some receipt books not found');
                error.status = 404;
                throw error;
            }

            const invalidBooks = books.filter(book =>
                book.status !== 'Assigned to Agent' || !book.agentID || book.ReceiptStub.status !== 'pending'
            );
            if (invalidBooks.length > 0) {
                const error = new Error('Some books are not assigned to an agent or stubs already processed');
                error.status = 400;
                throw error;
            }

            const agentIDs = [...new Set(books.map(book => book.agentID))];
            if (agentIDs.length > 1) {
                const error = new Error('All books must be assigned to the same agent');
                error.status = 400;
                throw error;
            }

            const agentID = agentIDs[0];
            const otp = await OTPService.generateOTP(agentID, 'agent');
            const agent = await Agent.findByPk(agentID);
            const smsResult = await sendSMS(
                agent.phone,
                `Your OTP for stub collection of ${bookIDs.length} receipt books is ${otp.code}`
            );
            if (!smsResult.success) {
                logger.warn(`SMS notification failed for agent ${agentID}: ${smsResult.reason}`, { ip: null });
            }

            logger.info(`Initiated stub collection for ${bookIDs.length} books by user ${userID}`, { ip: null });
            return { message: `OTP sent to agent for ${bookIDs.length} books` };
        } catch (error) {
            logger.error(`Collect stub error: ${error.message}, user: ${userID}`, { ip: null });
            throw error;
        }
    }

    static async validateStubCollection(bookIDs, supervisorID, otpCode) {
        try {
            const books = await ReceiptBook.findAll({
                where: { bookID: bookIDs },
                include: [Agent, ReceiptStub]
            });
            if (books.length !== bookIDs.length) {
                const error = new Error('Some receipt books not found');
                error.status = 404;
                throw error;
            }

            const invalidBooks = books.filter(book =>
                book.status !== 'Assigned to Agent' || !book.agentID || book.ReceiptStub.status !== 'pending'
            );
            if (invalidBooks.length > 0) {
                const error = new Error('Some books are not in valid state or stubs already processed');
                error.status = 400;
                throw error;
            }

            const agentIDs = [...new Set(books.map(book => book.agentID))];
            if (agentIDs.length > 1) {
                const error = new Error('All books must be assigned to the same agent');
                error.status = 400;
                throw error;
            }

            const agentID = agentIDs[0];
            await OTPService.validateOTP(agentID, otpCode, 'agent');

            await Promise.all(
                books.map(book =>
                    Promise.all([
                        book.update({ status: 'Stub Collected', agentID: null, currentHolderID: supervisorID }),
                        book.ReceiptStub.update({ status: 'collected' }),
                        ReceiptBookTransfer.create({
                            bookID: book.bookID,
                            fromAgentID: agentID,
                            toUserID: supervisorID,
                            status: 'Validated',
                            transferType: 'StubToSupervisor',
                        }),
                    ])
                )
            );

            const agent = await Agent.findByPk(agentID);
            const supervisor = await User.findByPk(supervisorID);
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: agent.email || supervisor.email,
                subject: `Stub Collection Validated for ${bookIDs.length} Books`,
                text: `Stubs for ${bookIDs.length} receipt books have been collected by Supervisor ${supervisorID}.`,
            });

            logger.info(`Validated stub collection for ${bookIDs.length} books by user ${supervisorID}`, { ip: null });
            return { message: `${bookIDs.length} stubs collected` };
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