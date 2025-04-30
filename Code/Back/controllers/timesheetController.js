const TimesheetService = require('../services/timesheetService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing timesheet-related operations.
 */
class TimesheetController {
    // --- Timesheet Retrieval Methods ---

    /**
     * Get all timesheets.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with timesheets or error.
     */
    static async getAllTimesheets(req, res) {
        try {
            const timesheets = await TimesheetService.listTimesheets();
            logger.info(`Fetched all timesheets by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(timesheets);
        } catch (error) {
            logger.error(`Get all timesheets error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: error.message || 'Failed to retrieve timesheets' });
        }
    }

    /**
     * Get a timesheet by ID.
     * @param {Object} req - Express request object with timesheet ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with timesheet or error.
     */
    static async getTimesheetById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Get timesheet failed: Missing timesheet ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Timesheet ID is required' });
            }
            const timesheet = await TimesheetService.viewTimesheet(id);
            logger.info(`Fetched timesheet ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(timesheet);
        } catch (error) {
            logger.error(`Get timesheet error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve timesheet' });
        }
    }

    /**
     * Get timesheets by supervisor.
     * @param {Object} req - Express request object with supervisorID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with timesheets or error.
     */
    static async getTimesheetsBySupervisor(req, res) {
        try {
            const { supervisorID } = req.params;
            if (!supervisorID) {
                logger.warn(`Get timesheets by supervisor failed: Missing supervisorID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID is required' });
            }
            const timesheets = await TimesheetService.getTimesheetsBySupervisor(supervisorID);
            logger.info(`Fetched timesheets for supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(timesheets);
        } catch (error) {
            logger.error(`Get timesheets by supervisor error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve timesheets for supervisor' });
        }
    }

    // --- Timesheet Modification Methods ---

    /**
     * Create a new timesheet.
     * @param {Object} req - Express request object with timesheet data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created timesheet or error.
     */
    static async createTimesheet(req, res) {
        try {
            const { weekNumber, year, supervisorID, visits, status = 'pending' } = req.body;
            if (!weekNumber || !year || !supervisorID || !Array.isArray(visits)) {
                logger.warn(`Create timesheet failed: Missing fields, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'weekNumber, year, supervisorID, and visits array are required' });
            }
            if (status && !['pending', 'validated'].includes(status)) {
                logger.warn(`Create timesheet failed: Invalid status, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Status must be "pending" or "validated"' });
            }
            const timesheet = await TimesheetService.createTimesheet({ weekNumber, year, supervisorID, visits, status }, req.user.userID);
            // Notify supervisor and manager of timesheet creation
            await NotificationService.triggerNotification({
                event: 'timesheet:created',
                data: { timesheetId: timesheet.timesheetID, supervisorID, weekNumber, year },
                metadata: { createdBy: req.user.email }
            });
            logger.info(`Timesheet created for supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(timesheet);
        } catch (error) {
            logger.error(`Create timesheet error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to create timesheet' });
        }
    }

    /**
     * Validate a timesheet.
     * @param {Object} req - Express request object with timesheet ID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with validated timesheet or error.
     */
    static async validateTimesheet(req, res) {
        try {
            const { id } = req.params;
            const { visitIDs = [], status } = req.body;
            if (!id) {
                logger.warn(`Validate timesheet failed: Missing timesheet ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Timesheet ID is required' });
            }
            if (!status) {
                logger.warn(`Validate timesheet failed: Missing status, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Status is required' });
            }
            const timesheet = await TimesheetService.validateTimesheet(id, visitIDs, status, req.user.userID);
            // Notify supervisor and manager of timesheet validation
            await NotificationService.triggerNotification({
                event: 'timesheet:validated',
                data: { timesheetId: id, status, supervisorID: timesheet.supervisorID },
                metadata: { validatedBy: req.user.email }
            });
            logger.info(`Timesheet ${id} validated by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(timesheet);
        } catch (error) {
            logger.error(`Validate timesheet error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to validate timesheet' });
        }
    }
}

module.exports = TimesheetController;