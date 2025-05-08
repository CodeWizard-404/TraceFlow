const { expect } = require('chai');
const sinon = require('sinon');
const { ReceiptBook, Agent, ReceiptStub } = require('../../models');
const OTPService = require('../../services/otpService');
const { sendSMS } = require('../../config/sms');
const ReceiptStubService = require('../../services/receiptStubService');

describe('ReceiptStubService', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('collectStub', () => {
        it('should successfully send OTP when book is properly assigned', async () => {
            const mockBook = {
                number: '12345',
                status: 'Assigned to Agent',
                agentID: 1,
                Agent: { phone: '1234567890' },
                ReceiptStub: { status: 'pending' }
            };

            sandbox.stub(ReceiptBook, 'findByPk').resolves(mockBook);
            sandbox.stub(OTPService, 'generateOTP').resolves({ code: '123456' });
            const sendSMSStub = sandbox.stub().resolves(); // Stub the sendSMS function directly

            // Replace the original sendSMS with the stub for this test
            const originalSendSMS = require('../../config/sms').sendSMS;
            require('../../config/sms').sendSMS = sendSMSStub;

            const result = await ReceiptStubService.collectStub(1);

            // Restore original sendSMS after the test
            require('../../config/sms').sendSMS = originalSendSMS;

            expect(result).to.deep.equal({ message: 'OTP sent to agent' });
            expect(sendSMSStub.calledOnce).to.be.true;
            expect(sendSMSStub.calledWith('1234567890', sinon.match.string)).to.be.true; // Check phone and OTP message
        });

        it('should throw error when book is not assigned to agent', async () => {
            const mockBook = {
                status: 'Available',
                agentID: null,
                ReceiptStub: { status: 'pending' }
            };

            sandbox.stub(ReceiptBook, 'findByPk').resolves(mockBook);

            try {
                await ReceiptStubService.collectStub(1);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Book not assigned to an agent');
            }
        });

        it('should throw error when stub is already processed', async () => {
            const mockBook = {
                status: 'Assigned to Agent',
                agentID: 1,
                ReceiptStub: { status: 'processed' }
            };

            sandbox.stub(ReceiptBook, 'findByPk').resolves(mockBook);

            try {
                await ReceiptStubService.collectStub(1);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Stub already processed');
            }
        });

        it('should throw error when book is not found', async () => {
            sandbox.stub(ReceiptBook, 'findByPk').resolves(null);

            try {
                await ReceiptStubService.collectStub(999);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });
});