// controllers/timesheetController.js
const { Timesheet } = require('../models');
const TimesheetService = require('../services/timesheetService');

class TimesheetController {
    static async createTimesheet(req, res) {
        try {
            const { weekNumber, year, supervisorID, visits } = req.body;
            if (!weekNumber || !year || !supervisorID || !Array.isArray(visits)) {
                return res.status(400).json({ error: 'Missing required fields: weekNumber, year, supervisorID, and visits array are mandatory' });
            }
            const timesheet = await TimesheetService.createTimesheet({ weekNumber, year, supervisorID, visits });
            res.status(201).json(timesheet);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Create timesheet failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to create timesheet due to an internal error' });
        }
    }

    static async validateTimesheet(req, res) {
        try {
            const { id } = req.params;
            const { visitIDs = [], status } = req.body;
            if (!status) {
                return res.status(400).json({ error: 'Status is required to validate a timesheet' });
            }
            const timesheet = await TimesheetService.validateTimesheet(id, visitIDs, status);
            res.status(200).json(timesheet);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Validate timesheet failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to validate timesheet due to an internal error' });
        }
    }

    static async getAllTimesheets(req, res) {
        try {
            const user = req.user;
            const userPermissions = user.Roles.flatMap(role => role.Permissions.map(perm => perm.name));
            let timesheets;

            if (userPermissions.includes('view_all_timesheets')) {
                timesheets = await Timesheet.findAll({ include: ['Visits'] });
            } else {
                timesheets = await Timesheet.findAll({
                    where: { supervisorID: user.userID },
                    include: ['Visits'],
                });
            }
            res.status(200).json(timesheets);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all timesheets failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve timesheets due to an internal error' });
        }
    }

    static async getTimesheetById(req, res) {
        try {
            const { id } = req.params;
            const timesheet = await TimesheetService.viewTimesheet(id);
            res.status(200).json(timesheet);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get timesheet failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve timesheet due to an internal error' });
        }
    }

    static async getTimesheetsBySupervisor(req, res) {
        try {
            const { supervisorID } = req.params;
            const timesheets = await TimesheetService.getTimesheetsBySupervisor(supervisorID);
            res.status(200).json(timesheets);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get timesheets by supervisor failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve timesheets for supervisor due to an internal error' });
        }
    }
}

module.exports = TimesheetController;