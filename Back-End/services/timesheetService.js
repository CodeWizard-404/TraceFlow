const { Visit, Reason, Checklist, Timesheet } = require('../models');
const VisitService = require('./visitService');


class TimesheetService {

    async CreateTimesheet(data) {
        try {
            const { weekNumber, year, supervisorID, visits } = data;

            // Check if a timesheet for the given week and year already exists
            let timesheet = await Timesheet.findOne({
                where: { weekNumber, year, supervisorID },
            });

            // If no timesheet exists, create one
            if (!timesheet) {
                timesheet = await Timesheet.create({
                    weekNumber,
                    year,
                    supervisorID,
                    status: 'pending',
                });
            }

            // Process each visit with reasons/checklists
            for (const visitData of visits) {
                const {
                    date,
                    time,
                    location,
                    agentID,
                    reasons = [],      // Added for visit reasons
                    checklists = [], // Added for checklist items
                } = visitData;

                // Create visit with associations
                await VisitService.createVisit({
                    date,
                    time,
                    location,
                    agentID,
                    supervisorID,
                    timesheetID: timesheet.timesheetID,
                    reasons,          // Pass reasons
                    checklists,   // Pass checklist items
                });
            }

            // Return updated timesheet with visits
            await Timesheet.findByPk(timesheet.timesheetID, {
                include: [
                    {model: Visit,include: [
                            {model: Checklist, through: { attributes: ["checked"] },},
                            {model: Reason,through: { attributes: [] },}]
                    }
                ]
            });
            return {
                message: 'Timesheet created successfully',
                timesheet
            };
        } catch (error) {
            throw new Error('Failed to add visits to timesheet: ' + error.message);
        }
    }

    async validateTimesheet(timesheetID, visitIDs = [], status) {
        try {
            const timesheet = await Timesheet.findByPk(timesheetID);
            if (!timesheet) throw new Error('Timesheet not found');
    
            // Fetch all visits associated with the timesheet
            const visits = await Visit.findAll({ where: { timesheetID } });
    
            let visitsToUpdate;
            if (visitIDs.length === 0) {
                // Validate all visits if no IDs are provided
                visitsToUpdate = visits;
            } else {
                // Validate only specified visits
                const visitIdSet = new Set(visitIDs);
                visitsToUpdate = visits.filter(visit => visitIdSet.has(visit.visitID));
    
                // Ensure all provided visit IDs exist in the timesheet
                if (visitsToUpdate.length !== visitIDs.length) {
                    throw new Error('One or more visit IDs not found in this timesheet');
                }
            }
    
            // Update the status of selected visits
            await Promise.all(visitsToUpdate.map(async (visit) => {
                visit.status = status;
                await visit.save();
            }));
    
            // Refetch visits to check the latest status
            const updatedVisits = await Visit.findAll({ where: { timesheetID } });
            const allValidated = updatedVisits.every(v => v.status === 'validated');
    
            // Update timesheet status if all visits are validated
            if (allValidated) {
                timesheet.status = 'validated';
                await timesheet.save();
            }
    
            return timesheet;
        } catch (error) {
            throw new Error(`Validation failed: ${error.message}`);
        }
    }

    async listTimesheets() {
        try {
            // Fetch all timesheets with associated visits
            const timesheets = await Timesheet.findAll({
                include: [
                    {
                        model: Visit,
                        include: [
                            { model: Checklist, through: { attributes: ["checked"] }, attributes: ["item"] },
                            { model: Reason, through: { attributes: [] }, attributes: ["item"] }]
                    }
                ],
            });

            return timesheets;
        } catch (error) {
            throw new Error('Failed to get timesheets: ' + error.message);
        }
    }

    async viewTimesheet(timesheetID) {
        try {
            // Find the timesheet by ID
            const timesheet = await Timesheet.findByPk(timesheetID, {
                include: [
                    {
                        model: Visit,
                        include: [
                            { model: Checklist, through: { attributes: ["checked"] }, attributes: ["item"] },
                            { model: Reason, through: { attributes: [] }, attributes: ["item"] }]
                    }
                ],
            });
            return timesheet;
        } catch (error) {
            throw new Error('Failed to get timesheet: ' + error.message);
        }
    }

    async getTimesheetsBySupervisor(supervisorID) {
        try {
            // Fetch all timesheets for the given supervisorID with associated visits
            const timesheets = await Timesheet.findAll({
                where: { supervisorID },
                include: [
                    {
                        model: Visit,
                        include: [
                            { model: Checklist, through: { attributes: ["checked"] }, attributes: ["item"] },
                            { model: Reason, through: { attributes: [] }, attributes: ["item"] }]
                    }
                ],
            });

            return timesheets;
        } catch (error) {
            throw new Error('Failed to get timesheets by supervisorID: ' + error.message);
        }
    }
}

module.exports = new TimesheetService();