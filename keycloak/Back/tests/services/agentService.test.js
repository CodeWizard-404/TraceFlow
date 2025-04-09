const { expect } = require('chai');
const sinon = require('sinon');
const { Agent } = require('../../models');
const AgentService = require('../../services/agentService');

describe('AgentService', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('getAgentById', () => {
        it('should return agent when valid id is provided', async () => {
            const mockAgent = { id: 1, name: 'Test Agent', phone: '1234567890' };
            sandbox.stub(Agent, 'findByPk').resolves(mockAgent);

            const result = await AgentService.getAgentById(1);

            expect(result).to.deep.equal(mockAgent);
            expect(Agent.findByPk.calledOnce).to.be.true;
            expect(Agent.findByPk.calledWith(1)).to.be.true;
        });

        it('should return null when agent is not found', async () => {
            sandbox.stub(Agent, 'findByPk').resolves(null);

            try {
                await AgentService.getAgentById(999);
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.equal('Agent not found');
                expect(err.status).to.equal(404);
            }
        });

        it('should throw error when database query fails', async () => {
            const error = new Error('Database error');
            sandbox.stub(Agent, 'findByPk').rejects(error);

            try {
                await AgentService.getAgentById(1);
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err).to.equal(error);
            }
        });

        it('should handle non-numeric id input', async () => {
            sandbox.stub(Agent, 'findByPk').resolves(null);

            try {
                await AgentService.getAgentById('invalid');
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.equal('Agent not found');
                expect(err.status).to.equal(404);
            }
        });
    });
});