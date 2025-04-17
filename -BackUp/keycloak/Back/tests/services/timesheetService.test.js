const { expect } = require('chai');
const sinon = require('sinon');
const { Visit, Reason, Checklist, Timesheet } = require('../../models');
const TimesheetService = require('../../services/timesheetService');
const VisitService = require('../../services/visitService');

describe('TimesheetService', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
        sinon.restore(); // Reset all Sinon state
    });

    afterAll(async () => {
        const sequelize = require('../../models').sequelize; // Adjust path
        await sequelize.close();
    });

    describe('createTimesheet', () => {
        it('should throw error when weekNumber is missing', async () => {
            const invalidData = {
                year: 2023,
                supervisorID: 1,
                visits: []
            };

            try {
                await TimesheetService.createTimesheet(invalidData);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Invalid input data');
                expect(error.status).to.equal(400);
            }
        });

        it('should throw error when year is missing', async () => {
            const invalidData = {
                weekNumber: 1,
                supervisorID: 1,
                visits: []
            };

            try {
                await TimesheetService.createTimesheet(invalidData);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Invalid input data');
                expect(error.status).to.equal(400);
            }
        });

        it('should throw error when supervisorID is missing', async () => {
            const invalidData = {
                weekNumber: 1,
                year: 2023,
                visits: []
            };

            try {
                await TimesheetService.createTimesheet(invalidData);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Invalid input data');
                expect(error.status).to.equal(400);
            }
        });

        it('should throw error when visits is not an array', async () => {
            const invalidData = {
                weekNumber: 1,
                year: 2023,
                supervisorID: 1,
                visits: 'not an array'
            };

            try {
                await TimesheetService.createTimesheet(invalidData);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Invalid input data');
                expect(error.status).to.equal(400);
            }
        });

        it('should use default status of pending when status is not provided', async () => {
            const validData = {
                weekNumber: 1,
                year: 2023,
                supervisorID: 1,
                visits: [
                    {
                        date: '2023-01-01',
                        time: '10:00',
                        agentID: 1,
                        reasons: [{ id: 1 }],
                        checklists: [{ id: 1 }]
                    }
                ]
            };

            // Stub Timesheet.findOne to simulate no existing timesheet
            sandbox.stub(Timesheet, 'findOne').resolves(null);

            // Stub Timesheet.create
            const createStub = sandbox.stub(Timesheet, 'create').resolves({
                timesheetID: 1,
                ...validData,
                status: 'pending',
                get: () => ({
                    timesheetID: 1,
                    ...validData,
                    status: 'pending'
                })
            });

            // Stub VisitService.createVisit
            sandbox.stub(VisitService, 'createVisit').resolves();

            // Stub Timesheet.findByPk (final return value)
            sandbox.stub(Timesheet, 'findByPk').resolves({
                timesheetID: 1,
                ...validData,
                status: 'pending',
                Visits: validData.visits,
                get: () => ({
                    timesheetID: 1,
                    ...validData,
                    status: 'pending',
                    Visits: validData.visits
                })
            });

            console.log('Before call - findOne stub active:', Timesheet.findOne !== Timesheet.findOne.wrappedMethod);
            console.log('Before call - create stub active:', Timesheet.create !== Timesheet.create.wrappedMethod);
            console.log('Before call - createVisit stub active:', VisitService.createVisit !== VisitService.createVisit.wrappedMethod);
            console.log('Before call - findByPk stub active:', Timesheet.findByPk !== Timesheet.findByPk.wrappedMethod);

            const result = await TimesheetService.createTimesheet(validData);

            console.log('findOne called:', Timesheet.findOne.called);
            console.log('create called:', createStub.called);
            console.log('createVisit called:', VisitService.createVisit.called);
            console.log('findByPk called:', Timesheet.findByPk.called);

            expect(result.get().status).to.equal('pending');
        });
    });
});