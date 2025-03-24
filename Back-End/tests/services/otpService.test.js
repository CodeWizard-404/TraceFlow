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
        it('should generate OTP for user with valid data', async () => {
            const mockCode = '123456';
            sandbox.stub(crypto, 'randomInt').returns(parseInt(mockCode));
            const mockOTP = {
                code: mockCode,
                userID: 1,
                expiresAt: sinon.match.date
            };
            const createStub = sandbox.stub(OTP, 'create').resolves(mockOTP);

            const result = await OTPService.generateOTP(1, 'user');

            expect(result).to.deep.equal(mockOTP);
            expect(createStub.calledOnce).to.be.true;
            expect(createStub.firstCall.args[0].userID).to.equal(1);
            expect(createStub.firstCall.args[0].code).to.equal(mockCode);
        });

        it('should generate OTP for agent with valid data', async () => {
            const mockCode = '123456';
            sandbox.stub(crypto, 'randomInt').returns(parseInt(mockCode));
            const mockOTP = {
                code: mockCode,
                agentID: 1,
                expiresAt: sinon.match.date
            };
            const createStub = sandbox.stub(OTP, 'create').resolves(mockOTP);

            const result = await OTPService.generateOTP(1, 'agent');

            expect(result).to.deep.equal(mockOTP);
            expect(createStub.calledOnce).to.be.true;
            expect(createStub.firstCall.args[0].agentID).to.equal(1);
            expect(createStub.firstCall.args[0].code).to.equal(mockCode);
        });

        it('should set default type to user when type not provided', async () => {
            const mockCode = '123456';
            sandbox.stub(crypto, 'randomInt').returns(parseInt(mockCode));
            const createStub = sandbox.stub(OTP, 'create').resolves({});

            await OTPService.generateOTP(1);

            expect(createStub.firstCall.args[0].userID).to.equal(1);
            expect(createStub.firstCall.args[0].agentID).to.be.undefined;
        });

        it('should set expiration time 10 minutes in the future', async () => {
            const now = new Date();
            sandbox.useFakeTimers(now.getTime());
            sandbox.stub(crypto, 'randomInt').returns(123456);
            const createStub = sandbox.stub(OTP, 'create').resolves({});

            await OTPService.generateOTP(1);

            const expectedExpiration = new Date(now.getTime() + 10 * 60 * 1000);
            expect(createStub.firstCall.args[0].expiresAt.getTime()).to.equal(expectedExpiration.getTime());
        });
    });
});
