const { Visit, Reason, Checklist, Timesheet } = require('../models');
const VisitService = require('./visitService');

class TimesheetService {
    static async createTimesheet(data) {
        const { weekNumber, year, supervisorID, visits, status = 'pending' } = data;

        // Validate required fields
        if (!weekNumber || !year || !supervisorID || !Array.isArray(visits)) {
            const error = new Error('Invalid input data');
            error.status = 400;
            throw error;
        }

        // Validate each visit structure
        for (const visit of visits) {
            if (!visit.date || !visit.time || !visit.agentID) {
                const error = new Error('Invalid visit data structure');
                error.status = 400;
                throw error;
            }
            if (!Array.isArray(visit.reasons) || visit.reasons.length === 0) {
                const error = new Error('At least one reason must be provided');
                error.status = 400;
                throw error;
            }
            if (!Array.isArray(visit.checklists) || visit.checklists.length === 0) {
                const error = new Error('At least one checklist item must be provided');
                error.status = 400;
                throw error;
            }
        }

        try {
            let timesheet = await Timesheet.findOne({ where: { weekNumber, year, supervisorID } });
            if (!timesheet) {
                timesheet = await Timesheet.create({ weekNumber, year, supervisorID, status });
            } else if (timesheet.status !== status) {
                timesheet.status = status;
                await timesheet.save();
            }

            for (const visitData of visits) {
                await VisitService.createVisit({
                    date: visitData.date,
                    time: visitData.time,
                    location: visitData.location,
                    agentID: visitData.agentID,
                    supervisorID,
                    timesheetID: timesheet.timesheetID,
                    reasons: visitData.reasons,
                    checklists: visitData.checklists,
                    status,
                });
            }

            return await Timesheet.findByPk(timesheet.timesheetID, {
                include: [
                    {
                        model: Visit,
                        include: [
                            { model: Checklist, through: { attributes: ["checked"] } },
                            { model: Reason, through: { attributes: [] } },
                        ],
                    },
                ],
            });
        } catch (error) {
            const err = new Error('Failed to create timesheet: ' + error.message);
            err.status = 500;
            throw err;
        }
    }

    static async updateTimesheet(timesheetID, updatedData) {
        const { weekNumber, year, status, supervisorID } = updatedData;

        try {
            const timesheet = await Timesheet.findByPk(timesheetID);
            if (!timesheet) {
                const error = new Error('Timesheet not found');
                error.status = 404;
                throw error;
            }

            // Only update fields if provided
            if (weekNumber !== undefined) timesheet.weekNumber = weekNumber;
            if (year !== undefined) timesheet.year = year;
            if (status !== undefined) timesheet.status = status;
            if (supervisorID !== undefined) timesheet.supervisorID = supervisorID;

            await timesheet.save();
            return timesheet.reload();
        } catch (error) {
            const err = new Error(`Failed to update timesheet: ${error.message}`);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async deleteTimesheet(timesheetID) {
        try {
            const timesheet = await Timesheet.findByPk(timesheetID);
            if (!timesheet) {
                const error = new Error('Timesheet not found');
                error.status = 404;
                throw error;
            }

            // Check if there are associated visits
            const visitCount = await Visit.count({ where: { timesheetID } });
            if (visitCount > 0) {
                const error = new Error('Cannot delete timesheet with associated visits');
                error.status = 400;
                throw error;
            }

            await timesheet.destroy();
            return { message: 'Timesheet deleted successfully' };
        } catch (error) {
            const err = new Error(`Failed to delete timesheet: ${error.message}`);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async validateTimesheet(timesheetID, visitIDs = [], status) {
        // Validate inputs
        if (!status || (Array.isArray(visitIDs) && visitIDs.some(id => typeof id !== 'string'))) {
            const error = new Error('Invalid input: status is required and visitIDs must be strings');
            error.status = 400;
            throw error;
        }

        try {
            // Fetch timesheet
            const timesheet = await Timesheet.findByPk(timesheetID);
            if (!timesheet) {
                const error = new Error('Timesheet not found');
                error.status = 404;
                throw error;
            }

            // Fetch all visits for the timesheet
            const visits = await Visit.findAll({ where: { timesheetID } });

            // Determine which visits to update (only pending or rejected)
            let visitsToUpdate;
            if (visitIDs.length === 0) {
                // If no visitIDs provided, update all pending or rejected visits
                visitsToUpdate = visits.filter(visit =>
                    visit.status === 'pending' || visit.status === 'rejected'
                );
            } else {
                // If visitIDs provided, update only those that are pending or rejected
                const visitIdSet = new Set(visitIDs);
                visitsToUpdate = visits.filter(visit =>
                    visitIdSet.has(visit.visitID) &&
                    (visit.status === 'pending' || visit.status === 'rejected')
                );
                // No error if some visitIDs don’t match—just skip them
            }

            // If no visits to update, return the timesheet as-is
            if (visitsToUpdate.length === 0) {
                return timesheet;
            }

            // Update the status of matching visits
            await Promise.all(visitsToUpdate.map(async (visit) => {
                visit.status = status;
                await visit.save();
            }));

            // Check if all visits are validated and update timesheet status if so
            const updatedVisits = await Visit.findAll({ where: { timesheetID } });
            if (updatedVisits.every(visit => visit.status === 'validated')) {
                timesheet.status = 'validated';
                await timesheet.save();
            }

            return timesheet;
        } catch (error) {
            const err = new Error(`Validation failed: ${error.message}`);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async listTimesheets() {
        try {
            return await Timesheet.findAll({
                include: [
                    {
                        model: Visit,
                        include: [
                            { model: Checklist, through: { attributes: ["checked"] }, attributes: ["item"] },
                            { model: Reason, through: { attributes: [] }, attributes: ["item"] },
                        ],
                    },
                ],
            });
        } catch (error) {
            const err = new Error('Failed to get timesheets: ' + error.message);
            err.status = 500;
            throw err;
        }
    }

    static async viewTimesheet(timesheetID) {
        try {
            const timesheet = await Timesheet.findByPk(timesheetID, {
                include: [
                    {
                        model: Visit,
                        include: [
                            { model: Checklist, through: { attributes: ["checked"] }, attributes: ["item"] },
                            { model: Reason, through: { attributes: [] }, attributes: ["item"] },
                        ],
                    },
                ],
            });
            if (!timesheet) {
                const error = new Error('Timesheet not found');
                error.status = 404;
                throw error;
            }
            return timesheet;
        } catch (error) {
            const err = new Error('Failed to get timesheet: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async getTimesheetsBySupervisor(supervisorID) {
        if (!supervisorID) {
            const error = new Error('Invalid supervisorID');
            error.status = 400;
            throw error;
        }
        try {
            return await Timesheet.findAll({
                where: { supervisorID },
                include: [
                    {
                        model: Visit,
                        include: [
                            { model: Checklist, through: { attributes: ["checked"] }, attributes: ["item"] },
                            { model: Reason, through: { attributes: [] }, attributes: ["item"] },
                        ],
                    },
                ],
            });
        } catch (error) {
            const err = new Error('Failed to get timesheets by supervisorID: ' + error.message);
            err.status = 500;
            throw err;
        }
    }


    static async updateTimesheet(timesheetID, data, filesMap = {}) {
        try {
            const { weekNumber, year, status, visits } = data;
            const timesheet = await Timesheet.findByPk(timesheetID, { include: [Visit] });
            if (!timesheet) {
                const error = new Error('Timesheet not found');
                error.status = 404;
                throw error;
            }
            timesheet.weekNumber = weekNumber || timesheet.weekNumber;
            timesheet.year = year || timesheet.year;
            timesheet.status = status || timesheet.status;
            await timesheet.save();

            if (visits && Array.isArray(visits)) {
                for (const visitData of visits) {
                    if (visitData.visitID) {
                        const files = filesMap[visitData.visitID] || []; // Files specific to this visit
                        await VisitService.updateVisit(visitData.visitID, visitData, files);
                    } else {
                        await VisitService.createVisit({
                            ...visitData,
                            timesheetID,
                            supervisorID: timesheet.supervisorID,
                        });
                    }
                }
            }
            return timesheet.reload({
                include: [
                    {
                        model: Visit,
                        include: [Checklist, Reason],
                    },
                ],
            });
        } catch (error) {
            const err = new Error('Failed to update timesheet: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async deleteTimesheet(timesheetID) {
        try {
            const timesheet = await Timesheet.findByPk(timesheetID, { include: [Visit] });
            if (!timesheet) {
                const error = new Error('Timesheet not found');
                error.status = 404;
                throw error;
            }
            await Promise.all(timesheet.Visits.map(visit => VisitService.deleteVisit(visit.visitID)));
            await timesheet.destroy();
            return { message: 'Timesheet and associated visits deleted successfully' };
        } catch (error) {
            const err = new Error('Failed to delete timesheet: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }
}

module.exports = TimesheetService;