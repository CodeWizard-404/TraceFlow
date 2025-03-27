const { Timesheet } = require('../models');
const TimesheetService = require('../services/timesheetService');

class TimesheetController {
    static async createTimesheet(req, res) {
        try {
            const { weekNumber, year, supervisorID, visits, status = 'pending' } = req.body;
            if (!weekNumber || !year || !supervisorID || !Array.isArray(visits)) {
                return res.status(400).json({ error: 'Missing required fields: weekNumber, year, supervisorID, and visits array are mandatory' });
            }
            if (status && !['pending', 'validated'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status value. Must be "pending" or "validated"' });
            }

            const timesheet = await TimesheetService.createTimesheet({ weekNumber, year, supervisorID, visits, status });
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
            const timesheets = await TimesheetService.listTimesheets();
            res.status(200).json(timesheets);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all timesheets failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve all timesheets due to an internal error' });
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

    static async updateTimesheet(req, res) {
        try {
            const { id } = req.params;
            const { weekNumber, year, status, visits } = req.body;
            const userPermissions = req.user?.Roles?.flatMap(role => role.Permissions?.map(perm => perm.name) || []) || [];
            if (!userPermissions.includes('edit_timesheets_for_supervisor')) {
                return res.status(403).json({ error: 'Permission denied: Only users with edit_timesheets_for_supervisor can update timesheets' });
            }

            const parsedVisits = typeof visits === 'string' ? JSON.parse(visits) : visits;
            const filesMap = {};
            if (req.files) {
                req.files.forEach(file => {
                    const visitId = file.fieldname.split('.')[1]; // e.g., "photos.vis_123" -> "vis_123"
                    if (!filesMap[visitId]) filesMap[visitId] = [];
                    filesMap[visitId].push(file);
                });
            }

            const timesheet = await TimesheetService.updateTimesheet(id, { weekNumber, year, status, visits: parsedVisits }, filesMap);
            res.status(200).json(timesheet);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update timesheet failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to update timesheet due to an internal error' });
        }
    }

    static async deleteTimesheet(req, res) {
        try {
            const { id } = req.params;
            const userPermissions = req.user?.Roles?.flatMap(role => role.Permissions?.map(perm => perm.name) || []) || [];
            if (!userPermissions.includes('delete_timesheets_for_supervisor')) {
                return res.status(403).json({ error: 'Permission denied: Only users with delete_timesheets_for_supervisor can delete timesheets' });
            }
            const result = await TimesheetService.deleteTimesheet(id);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Delete timesheet failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to delete timesheet due to an internal error' });
        }
    }
}

module.exports = TimesheetController;