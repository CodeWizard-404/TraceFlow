const TimesheetService = require('../services/timesheetService');

class TimesheetController {
    static async createTimesheet(req, res) {
        try {
            const { weekNumber, year, supervisorID, visits } = req.body;
            const timesheet = await TimesheetService.createTimesheet({
                weekNumber,
                year,
                supervisorID,
                visits,
            });
            res.status(201).json(timesheet);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }

    static async validateTimesheet(req, res) {
        try {
            const { id } = req.params;
            const { visitIDs = [], status } = req.body;
            const timesheet = await TimesheetService.validateTimesheet(id, visitIDs, status);
            res.status(200).json(timesheet);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }

    static async getAllTimesheets(req, res) {
        try {
            const timesheets = await TimesheetService.listTimesheets();
            res.status(200).json(timesheets);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }

    static async getTimesheetById(req, res) {
        try {
            const { id } = req.params;
            const timesheet = await TimesheetService.viewTimesheet(id);
            res.status(200).json(timesheet);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }

    static async getTimesheetsBySupervisor(req, res) {
        try {
            const { supervisorID } = req.params;
            const timesheets = await TimesheetService.getTimesheetsBySupervisor(supervisorID);
            res.status(200).json(timesheets);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }
};

module.exports = TimesheetController;