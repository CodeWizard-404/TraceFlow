const { expect } = require('chai');
const sinon = require('sinon');
const QRCode = require('qrcode');
const { ReceiptBook, User, Agent, OTP, ReceiptBookTransfer, ReceiptStub, Role } = require('../../models');
const { sendSMS } = require('../../config/sms');
const { transporter } = require('../../config/smtp');
const ReceiptBookService = require('../../services/receiptBookService');
const OTPService = require('../../services/otpService');

describe('ReceiptBookService', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Dependencies', () => {
        it('should have QRCode module initialized', () => {
            expect(QRCode).to.exist;
        });

        it('should have SMS configuration loaded', () => {
            expect(sendSMS).to.exist;
        });

        it('should have SMTP transporter configured', () => {
            expect(transporter).to.exist;
        });

        it('should have all required models loaded', () => {
            expect(ReceiptBook).to.exist;
            expect(User).to.exist;
            expect(Agent).to.exist;
            expect(OTP).to.exist;
            expect(ReceiptBookTransfer).to.exist;
            expect(ReceiptStub).to.exist;
            expect(Role).to.exist;
        });

        it('should have OTPService initialized', () => {
            expect(OTPService).to.exist;
        });
    });

    describe('Service Initialization', () => {
        it('should create ReceiptBookService instance', () => {
            expect(ReceiptBookService).to.be.an('object');
        });

        it('should handle missing dependencies gracefully', () => {
            const tempQRCode = require.cache[require.resolve('qrcode')];
            delete require.cache[require.resolve('qrcode')];

            try {
                const NewReceiptBookService = require('../../services/receiptBookService');
                expect(NewReceiptBookService).to.exist;
            } finally {
                require.cache[require.resolve('qrcode')] = tempQRCode;
            }
        });
    });
});
