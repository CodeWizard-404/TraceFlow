const TimesheetService = require('../services/timesheetService');
const logger = require('../utils/logger');

class TimesheetController {
    static async createTimesheet(req, res) {
        try {
            const { weekNumber, year, supervisorID, visits, status = 'pending' } = req.body;
            if (!weekNumber || !year || !supervisorID || !Array.isArray(visits)) {
                logger.warn(`Create timesheet failed: Missing fields, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Missing required fields: weekNumber, year, supervisorID, and visits array are mandatory' });
            }
            if (status && !['pending', 'validated'].includes(status)) {
                logger.warn(`Create timesheet failed: Invalid status, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Invalid status value. Must be "pending" or "validated"' });
            }

            const timesheet = await TimesheetService.createTimesheet({ weekNumber, year, supervisorID, visits, status }, req.user.userID);
            logger.info(`Timesheet created for supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(201).json(timesheet);
        } catch (error) {
            logger.error(`Create timesheet error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to create timesheet due to an internal error' });
        }
    }

    static async validateTimesheet(req, res) {
        try {
            const { id } = req.params;
            const { visitIDs = [], status } = req.body;
            if (!id) {
                logger.warn(`Validate timesheet failed: Missing timesheet ID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Timesheet ID is required' });
            }
            if (!status) {
                logger.warn(`Validate timesheet failed: Missing status, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Status is required to validate a timesheet' });
            }
            const timesheet = await TimesheetService.validateTimesheet(id, visitIDs, status, req.user.userID);
            logger.info(`Timesheet ${id} validated by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(timesheet);
        } catch (error) {
            logger.error(`Validate timesheet error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to validate timesheet due to an internal error' });
        }
    }

    static async getAllTimesheets(req, res) {
        try {
            const timesheets = await TimesheetService.listTimesheets();
            logger.info(`Fetched all timesheets by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(timesheets);
        } catch (error) {
            logger.error(`Get all timesheets error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to retrieve all timesheets due to an internal error' });
        }
    }

    static async getTimesheetById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Get timesheet failed: Missing timesheet ID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Timesheet ID is required' });
            }
            const timesheet = await TimesheetService.viewTimesheet(id);
            logger.info(`Fetched timesheet ${id} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(timesheet);
        } catch (error) {
            logger.error(`Get timesheet error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve timesheet due to an internal error' });
        }
    }

    static async getTimesheetsBySupervisor(req, res) {
        try {
            const { supervisorID } = req.params;
            if (!supervisorID) {
                logger.warn(`Get timesheets by supervisor failed: Missing supervisorID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Supervisor ID is required' });
            }
            const timesheets = await TimesheetService.getTimesheetsBySupervisor(supervisorID);
            logger.info(`Fetched timesheets for supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(timesheets);
        } catch (error) {
            logger.error(`Get timesheets by supervisor error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve timesheets for supervisor due to an internal error' });
        }
    }
}

module.exports = TimesheetController;