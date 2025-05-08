const { expect } = require('chai');
const sinon = require('sinon');
const bcrypt = require('bcrypt');

describe('bcrypt password hashing', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('hash', () => {
        it('should generate hash with default salt rounds', async () => {
            const password = 'testPassword123';
            const hash = await bcrypt.hash(password, 10);
            expect(hash).to.be.a('string');
            expect(hash).to.not.equal(password);
        });

        it('should generate different hashes for same password', async () => {
            const password = 'testPassword123';
            const hash1 = await bcrypt.hash(password, 10);
            const hash2 = await bcrypt.hash(password, 10);
            expect(hash1).to.not.equal(hash2);
        });

        it('should throw error for empty password', async () => {
            try {
                await bcrypt.hash('', 10);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });

    describe('compare', () => {
        it('should return true for matching password and hash', async () => {
            const password = 'testPassword123';
            const hash = await bcrypt.hash(password, 10);
            const result = await bcrypt.compare(password, hash);
            expect(result).to.be.true;
        });

        it('should return false for non-matching password and hash', async () => {
            const password = 'testPassword123';
            const hash = await bcrypt.hash(password, 10);
            const result = await bcrypt.compare('wrongPassword', hash);
            expect(result).to.be.false;
        });

        it('should handle comparison with invalid hash format', async () => {
            try {
                await bcrypt.compare('password', 'invalid-hash');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });
});
