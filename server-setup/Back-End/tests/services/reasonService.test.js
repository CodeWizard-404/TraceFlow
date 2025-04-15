const { expect } = require('chai');
const sinon = require('sinon');
const { Reason } = require('../../models');
const ReasonService = require('../../services/reasonService');

describe('ReasonService', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('createItem', () => {
        it('should create a new reason item with valid text', async () => {
            const mockReason = { reasonID: 1, item: 'Test Reason' };
            sandbox.stub(Reason, 'create').resolves(mockReason);

            const result = await ReasonService.createItem('Test Reason');
            expect(result).to.deep.equal(mockReason);
        });

        it('should handle empty text input', async () => {
            const mockReason = { reasonID: 1, item: '' };
            sandbox.stub(Reason, 'create').resolves(mockReason);

            const result = await ReasonService.createItem('');
            expect(result).to.deep.equal(mockReason);
        });
    });

    describe('getItemsByIds', () => {
        it('should return items for valid ids', async () => {
            const mockReasons = [
                { reasonID: 1, item: 'Reason 1' },
                { reasonID: 2, item: 'Reason 2' }
            ];
            sandbox.stub(Reason, 'findAll').resolves(mockReasons);

            const result = await ReasonService.getItemsByIds([1, 2]);
            expect(result).to.deep.equal(mockReasons);
        });

        it('should throw error when not all ids are found', async () => {
            const mockReasons = [{ reasonID: 1, item: 'Reason 1' }];
            sandbox.stub(Reason, 'findAll').resolves(mockReasons);

            try {
                await ReasonService.getItemsByIds([1, 2]);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('One or more reason IDs do not exist');
            }
        });

        it('should handle empty ids array', async () => {
            sandbox.stub(Reason, 'findAll').resolves([]);

            const result = await ReasonService.getItemsByIds([]);
            expect(result).to.be.an('array').that.is.empty;
        });
    });
});
