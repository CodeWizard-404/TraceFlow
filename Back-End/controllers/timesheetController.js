const TimesheetService = require('../services/timesheetService');

// Create a new timesheet or add visits to an existing one
const TimesheetController = {
    async createTimesheet(req, res) {
        try {
            const { weekNumber, year, supervisorID, visits } = req.body;

            // Validate required fields
            if (!weekNumber || !year || !supervisorID || !Array.isArray(visits)) {
                return res.status(400).json({ error: 'Invalid input data' });
            }

            // Call the TimesheetService to create or update the timesheet
            const timesheet = await TimesheetService.CreateTimesheet({
                weekNumber,
                year,
                supervisorID,
                visits,
            });

            res.status(201).json(timesheet);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Validate a timesheet (fully or partially)
    async validateTimesheet(req, res) {
        try {
            const { id } = req.params;
            const { visitIDs = [], status } = req.body;
    
            // ✅ Correct validation for strings
            if (!status || (Array.isArray(visitIDs) && visitIDs.some(id => typeof id !== 'string')) ){
                return res.status(400).json({ error: 'Invalid input data' });
            }
    
            const timesheet = await TimesheetService.validateTimesheet(id, visitIDs, status);
            res.status(200).json(timesheet);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // View all timesheets (for managers or HR)
    async getAllTimesheets(req, res) {
        try {
            // Call the TimesheetService to get all timesheets
            const timesheets = await TimesheetService.listTimesheets();

            res.status(200).json(timesheets);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }

    },

    // View a specific timesheet by ID
    async getTimesheetById(req, res) {
        try {
            const { id } = req.params;

            // Fetch the timesheet by ID
            const timesheet = await TimesheetService.viewTimesheet(id);
            if (!timesheet) return res.status(404).json({ error: 'Timesheet not found' });

            res.status(200).json(timesheet);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // controllers/timesheetController.js
    async getTimesheetsBySupervisor(req, res) {
        try {
            const { supervisorID } = req.params;

            // Validate that supervisorID is provided
            if (!supervisorID) {
                return res.status(400).json({ error: 'Invalid supervisorID' });
            }

            // Call the TimesheetService to fetch timesheets by supervisorID
            const timesheets = await TimesheetService.getTimesheetsBySupervisor(supervisorID);

            res.status(200).json(timesheets);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};


module.exports = TimesheetController;