const Timesheet = require('../models/timesheet');
const Visit = require('../models/visit');
const Agent = require('../models/agent');

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

    async validateTimesheet(timesheetID, visitIDs = [], status) {
        try {
            // Find the timesheet
            const timesheet = await Timesheet.findByPk(timesheetID);
            if (!timesheet) throw new Error('Timesheet not found');

            // Fetch all visits associated with the timesheet
            const visits = await Visit.findAll({ where: { timesheetID } });

            // If no specific visit IDs are provided, validate the entire timesheet
            if (visitIDs.length === 0) {
                for (const visit of visits) {
                    visit.status = status;
                    await visit.save();
                }
                timesheet.status = status;
                await timesheet.save();
                return timesheet;
            }

            // Otherwise, validate only the specified visits
            for (const visitID of visitIDs) {
                const visit = visits.find((v) => v.visitID === visitID);
                if (!visit) throw new Error(`Visit with ID ${visitID} not found`);
                visit.status = status;
                await visit.save();
            }

            // Check if all visits in the timesheet are now validated
            const allVisitsValidated = visits.every((visit) => visit.status === 'validated');
            if (allVisitsValidated) {
                timesheet.status = 'validated';
                await timesheet.save();
            }

            return timesheet;
        } catch (error) {
            throw new Error('Failed to validate timesheet: ' + error.message);
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