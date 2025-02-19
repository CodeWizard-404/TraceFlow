const Timesheet = require('../models/Timesheet');
const Visit = require('../models/visit');

class TimesheetService {
    async createTimesheet(data) {
        try {
            const { weekNumber, year, supervisorID } = data;

            // Create the timesheet
            const timesheet = await Timesheet.create({
                weekNumber,
                year,
                supervisorID,
            });

            return timesheet;
        } catch (error) {
            throw new Error('Failed to create timesheet: ' + error.message);
        }
    }

    async addVisitToTimesheet(timesheetID, visitID) {
        try {
            const timesheet = await Timesheet.findByPk(timesheetID);
            const visit = await Visit.findByPk(visitID);

            if (!timesheet || !visit) throw new Error('Timesheet or Visit not found');

            // Associate visit with timesheet
            visit.timesheetID = timesheetID;
            await visit.save();

            return timesheet;
        } catch (error) {
            throw new Error('Failed to add visit to timesheet: ' + error.message);
        }
    }

    async validateTimesheet(timesheetID) {
        try {
            const timesheet = await Timesheet.findByPk(timesheetID);
            if (!timesheet) throw new Error('Timesheet not found');

            timesheet.status = 'validated';
            await timesheet.save();
            return timesheet;
        } catch (error) {
            throw new Error('Failed to validate timesheet: ' + error.message);
        }
    }
}

module.exports = new TimesheetService();