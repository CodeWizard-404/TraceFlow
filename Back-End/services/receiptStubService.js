const { ReceiptStub, ReceiptBook, Agent, OTP, User, ReceiptBookTransfer} = require('../models');
const { sendSMS } = require('../config/sms');
const { transporter } = require('../config/smtp');
const { OTPService } = require('./otpService');

class ReceiptStubService {



    static async collectStub(bookID, supervisorID) {
        const book = await ReceiptBook.findByPk(bookID, { include: [Agent, ReceiptStub] });
        if (!book || !book.agentID) throw new Error('ReceiptBook not assigned to an Agent');
        if (book.ReceiptStub.status !== 'pending') throw new Error('Stub already collected or processed');

        const otp = await OTPService.generateOTP(book.agentID);
        await sendSMS(book.Agent.phone, `Your OTP to confirm stub collection for Receipt Book #${book.number} is ${otp.code}`);

        return { message: 'OTP sent to Agent' };
    }

    static async validateStubCollection(bookID, supervisorID, otpCode) {
        const book = await ReceiptBook.findByPk(bookID, { include: [Agent, ReceiptStub] });
        if (!book || !book.agentID) throw new Error('ReceiptBook not assigned to an Agent');
        if (book.ReceiptStub.status !== 'pending') throw new Error('Stub already collected or processed');

        await OTPService.validateOTP(book.agentID, otpCode);

        await Promise.all([
            book.ReceiptStub.update({ status: 'collected' }),
            book.update({ status: 'Stub Collected', agentID: null, currentHolderID: supervisorID }),
            book.setUsers([supervisorID]),
            ReceiptBookTransfer.create({
                bookID,
                fromAgentID: book.agentID,
                toUserID: supervisorID,
                status: 'Stub Collected',
            }),
        ]);

        const supervisor = await User.findByPk(supervisorID);
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: supervisor.email,
            subject: `Stub Collected for Receipt Book #${book.number}`,
            text: `Stub for Receipt Book #${book.number} has been collected.`,
        });

        return book.ReceiptStub;
    }



    static async transmitStub(bookID, newOwnerID, currentUserID) {
        const book = await ReceiptBook.findByPk(bookID, { include: [ReceiptStub] });
        if (!book.ReceiptStub || book.ReceiptStub.status !== 'collected') {
            throw new Error('Stub not collected yet');
        }
        if (book.currentHolderID !== currentUserID) {
            throw new Error('Only the current holder can transmit the stub');
        }

        const newOwner = await User.findByPk(newOwnerID);
        if (!newOwner) throw new Error('User not found');

        // Generate OTP for the new owner
        const otp = await OTPService.generateOTP(newOwnerID);
        await sendSMS(newOwner.phone, `Your OTP to receive stub for Receipt Book #${book.number} is ${otp.code}`);

        return { message: `OTP sent to user ${newOwnerID} for stub transmission` };
    }

    static async validateTransmitStub(bookID, newOwnerID, currentUserID, otpCode) {
        const book = await ReceiptBook.findByPk(bookID, { include: [ReceiptStub] });
        if (!book.ReceiptStub || book.ReceiptStub.status !== 'collected') {
            throw new Error('Stub not collected yet');
        }
        if (book.currentHolderID !== currentUserID) {
            throw new Error('Only the current holder can transmit the stub');
        }

        const newOwner = await User.findByPk(newOwnerID);
        if (!newOwner) throw new Error('User not found');

        // Validate OTP
        await OTPService.validateOTP(newOwnerID, otpCode);

        const newOwnerRole = await newOwner.getRoles();
        const roleName = newOwnerRole.length > 0 ? newOwnerRole[0].name : 'Unknown';

        let newStatus;
        switch (roleName) {
            case 'Regional Manager':
                newStatus = 'With Regional Manager';
                break;
            case 'Stock Manager':
                newStatus = 'With Stock Manager';
                break;
            default:
                newStatus = 'With Regional Manager';
        }

        await Promise.all([
            book.setUsers([newOwnerID]),
            book.update({ status: newStatus, currentHolderID: newOwnerID }),
            book.ReceiptStub.update({ status: 'transmitted' }),
            ReceiptBookTransfer.create({
                bookID,
                fromUserID: currentUserID,
                toUserID: newOwnerID,
                status: newStatus,
            }),
        ]);

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: newOwner.email,
            subject: `Stub Transmitted for Receipt Book #${book.number}`,
            text: `Stub for Receipt Book #${book.number} has been transmitted to you.`,
        });

        return book.ReceiptStub;
    }


    
    static async archiveStub(bookID, stockManagerID) {
        const book = await ReceiptBook.findByPk(bookID, { include: [ReceiptStub] });
        if (book.currentHolderID !== stockManagerID) throw new Error('Only the current stock manager can archive');
        if (book.ReceiptStub.status === 'archived') throw new Error('Stub already archived');

        await Promise.all([
            book.update({ status: 'Archived' }),
            book.ReceiptStub.update({ status: 'archived' }),
            ReceiptBookTransfer.create({
                bookID,
                fromUserID: stockManagerID,
                toUserID: stockManagerID,
                status: 'Archived',
            }),
        ]);

        return book.ReceiptStub;
    }


}

module.exports = ReceiptStubService;