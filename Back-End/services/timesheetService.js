const { Visit, Agent, Timesheet } = require('../models');


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

            // Add each visit to the timesheet
            for (const visitData of visits) {
                const { date, time, agentID } = visitData;

                // Validate agent exists and retrieve the agent's location
                const agent = await Agent.findByPk(agentID);
                if (!agent) throw new Error(`Agent with ID ${agentID} not found`);

                // Use the agent's location from the Agent table
                const location = agent.location;

                // Create the visit and associate it with the timesheet
                await Visit.create({
                    date,
                    time,
                    location,
                    agentID,
                    timesheetID: timesheet.timesheetID,
                    status: 'pending',
                });
            }

            // Fetch the updated timesheet with all visits included
            const updatedTimesheet = await Timesheet.findByPk(timesheet.timesheetID, {
                include: [Visit], // Include associated visits
            });

            return updatedTimesheet;
        } catch (error) {
            throw new Error('Failed to add visits to timesheet: ' + error.message);
        }
    }

    // services/timesheetService.js
    async validateTimesheet(timesheetID, visitIDs = [], status) {
        try {
            const timesheet = await Timesheet.findByPk(timesheetID);
            if (!timesheet) throw new Error('Timesheet not found');

            // Get all visits for this timesheet
            const visits = await Visit.findAll({
                where: { timesheetID }
            });

            // Convert to Set for faster lookup
            const visitIdSet = new Set(visitIDs);

            // Validate matching visits
            const visitsToUpdate = visits.filter(visit =>
                visitIdSet.has(visit.visitID)
            );

            if (visitsToUpdate.length !== visitIDs.length) {
                throw new Error('One or more visit IDs not found in this timesheet');
            }

            // Update visits
            await Promise.all(
                visitsToUpdate.map(visit => {
                    visit.status = status;
                    return visit.save();
                })
            );

            // Update timesheet status if all visits validated
            const allValidated = visits.every(v => v.status === 'validated');
            if (allValidated) {
                timesheet.status = 'validated';
                await timesheet.save();
            }

            return timesheet;
        } catch (error) {
            throw new Error('Validation failed: ' + error.message);
        }
    }

    async listTimesheets() {
        try {
            // Fetch all timesheets with associated visits
            const timesheets = await Timesheet.findAll({
                include: [Visit],
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
                include: [Visit],
            });
            return timesheet;
        } catch (error) {
            throw new Error('Failed to get timesheet: ' + error.message);
        }
    }
}

module.exports = new TimesheetService();