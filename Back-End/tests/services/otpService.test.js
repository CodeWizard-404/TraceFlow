const { expect } = require('chai');
const sinon = require('sinon');
const crypto = require('crypto');
const { OTP } = require('../../models');
const OTPService = require('../../services/otpService');

describe('OTPService', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('generateOTP', () => {
        it('should generate OTP for user with correct format', async () => {
            const mockCode = '123456';
            sandbox.stub(crypto, 'randomInt').returns(mockCode);
            const createStub = sandbox.stub(OTP, 'create').resolves({ code: mockCode });

            const result = await OTPService.generateOTP(1, 'user');

            expect(createStub.calledOnce).to.be.true;
            const createArgs = createStub.getCall(0).args[0];
            expect(createArgs.code).to.equal(mockCode);
            expect(createArgs.userID).to.equal(1);
            expect(createArgs.expiresAt).to.be.instanceof(Date);
        });

        it('should generate OTP for agent with correct format', async () => {
            const mockCode = '654321';
            sandbox.stub(crypto, 'randomInt').returns(mockCode);
            const createStub = sandbox.stub(OTP, 'create').resolves({ code: mockCode });

            const result = await OTPService.generateOTP(2, 'agent');

            expect(createStub.calledOnce).to.be.true;
            const createArgs = createStub.getCall(0).args[0];
            expect(createArgs.code).to.equal(mockCode);
            expect(createArgs.agentID).to.equal(2);
            expect(createArgs.expiresAt).to.be.instanceof(Date);
        });

        it('should default to user type when no type specified', async () => {
            const mockCode = '789012';
            sandbox.stub(crypto, 'randomInt').returns(mockCode);
            const createStub = sandbox.stub(OTP, 'create').resolves({ code: mockCode });

            const result = await OTPService.generateOTP(3);

            expect(createStub.calledOnce).to.be.true;
            const createArgs = createStub.getCall(0).args[0];
            expect(createArgs.userID).to.equal(3);
            expect(createArgs.agentID).to.be.undefined;
        });

        it('should set expiration time 10 minutes in the future', async () => {
            const now = new Date('2023-01-01T10:00:00Z');
            sandbox.useFakeTimers(now);
            sandbox.stub(crypto, 'randomInt').returns('123456');
            const createStub = sandbox.stub(OTP, 'create').resolves({});

            await OTPService.generateOTP(1);

            const createArgs = createStub.getCall(0).args[0];
            expect(createArgs.expiresAt.getTime()).to.equal(now.getTime() + 10 * 60 * 1000);
        });
    });
});
