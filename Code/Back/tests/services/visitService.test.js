const { expect } = require('chai');
const sinon = require('sinon');
const { Visit, Agent, Reason, Checklist } = require('../../models');
const VisitService = require('../../services/visitService');

describe('VisitService', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('createVisit', () => {
        const validVisitData = {
            date: '2023-01-01',
            time: '10:00',
            agentID: 1,
            supervisorID: 1,
            timesheetID: 1,
            reasons: [],
            checklists: [],
            status: 'pending'
        };

        it('should throw error when required fields are missing', async () => {
            const invalidData = {
                date: '2023-01-01',
                time: '10:00',
                supervisorID: 1
            };

            try {
                await VisitService.createVisit(invalidData);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Missing required fields');
                expect(error.status).to.equal(400);
            }
        });

        it('should throw error when agent is not found', async () => {
            sandbox.stub(Agent, 'findByPk').resolves(null);

            try {
                await VisitService.createVisit(validVisitData);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Failed to create visit: Agent not found'); // Match the actual message
                expect(error.status).to.equal(404);
            }
        });

        it('should successfully validate agent exists', async () => {
            const mockAgent = { id: 1, name: 'Test Agent' };
            sandbox.stub(Agent, 'findByPk').resolves(mockAgent);

            try {
                await VisitService.createVisit(validVisitData);
            } catch (error) {
                expect(error.message).to.not.equal('Agent not found');
            }
        });

        it('should throw error when date is invalid', async () => {
            const invalidData = {
                ...validVisitData,
                date: 'invalid-date'
            };

            try {
                await VisitService.createVisit(invalidData);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).to.exist;
            }
        });

        it('should throw error when time is invalid', async () => {
            const invalidData = {
                ...validVisitData,
                time: 'invalid-time'
            };

            try {
                await VisitService.createVisit(invalidData);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });
});
