const { ReceiptBook, Agent, User, ReceiptStub, ReceiptBookTransfer } = require('../models');
const OTPService = require('./otpService');
const { sendSMS } = require('../config/sms');

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

            return { message: `OTP sent to agent for ${bookIDs.length} books` };
        } catch (error) {
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

            return { message: `${bookIDs.length} stubs collected` };
        } catch (error) {
            throw error;
        }
    }

    static async archiveStub(bookIDs, stockManagerID) {
        try {
            const books = await ReceiptBook.findAll({
                where: { bookID: bookIDs },
                include: [ReceiptStub]
            });
            if (books.length !== bookIDs.length) {
                const error = new Error('Some receipt books not found');
                error.status = 404;
                throw error;
            }

            const invalidBooks = books.filter(book =>
                book.currentHolderID !== stockManagerID ||
                book.status !== 'With Stock Manager' ||
                book.ReceiptStub.status === 'archived'
            );
            if (invalidBooks.length > 0) {
                const error = new Error('Some books are not with stock manager or stubs already archived');
                error.status = 400;
                throw error;
            }

            await Promise.all(
                books.map(book =>
                    Promise.all([
                        book.update({ status: 'Archived' }),
                        book.ReceiptStub.update({ status: 'archived' }),
                        ReceiptBookTransfer.create({
                            bookID: book.bookID,
                            fromUserID: stockManagerID,
                            toUserID: stockManagerID,
                            status: 'Validated',
                            transferType: 'Archived',
                        }),
                    ])
                )
            );

            return { message: `${bookIDs.length} stubs archived` };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = ReceiptStubService;