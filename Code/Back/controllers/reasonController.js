const ReasonService = require('../services/reasonService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing reason operations.
 */
class ReasonController {
    // --- Reason Retrieval Methods ---

    /**
     * Get all reasons.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with reasons or error.
     */
    static async getAllReasons(req, res) {
        try {
            const reasons = await ReasonService.getAllReasons();
            logger.info(`Fetched all reasons by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(reasons);
        } catch (error) {
            logger.error(`Get all reasons error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve reasons' });
        }
    }

    /**
     * Get a reason by ID.
     * @param {Object} req - Express request object with reason ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with reason or error.
     */
    static async getReasonByID(req, res) {
        try {
            const { id: reasonID } = req.params;
            if (!reasonID) {
                logger.warn(`Get reason failed: Missing reasonID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Reason ID is required' });
            }
            const reason = await ReasonService.getItemById(reasonID);
            logger.info(`Fetched reason ${reasonID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(reason);
        } catch (error) {
            logger.error(`Get reason error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Reason not found' });
        }
    }

    /**
     * Get reasons by visit ID.
     * @param {Object} req - Express request object with visit ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with reasons or error.
     */
    static async getReasonsByVisitID(req, res) {
        try {
            const { id: visitID } = req.params;
            if (!visitID) {
                logger.warn(`Get reasons by visit failed: Missing visitID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const reasons = await ReasonService.getReasonsByVisitId(visitID);
            logger.info(`Fetched reasons for visit ${visitID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(reasons);
        } catch (error) {
            logger.error(`Get reasons by visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Reasons not found for visit' });
        }
    }

    // --- Reason Modification Methods ---

    /**
     * Create a new reason.
     * @param {Object} req - Express request object with text in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created reason or error.
     */
    static async createReason(req, res) {
        try {
            const { text } = req.body;
            if (!text) {
                logger.warn(`Create reason failed: Missing text, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Reason text is required' });
            }
            const reason = await ReasonService.createItem(text, req.user.userID);
            // Notify creator and manager of new reason
            await NotificationService.triggerNotification({
                event: 'reason:created',
                data: { reasonID: reason.reasonID, text },
                metadata: { createdBy: req.user.email },
            });
            logger.info(`Reason ${reason.reasonID} created by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(reason);
        } catch (error) {
            logger.error(`Create reason error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to create reason' });
        }
    }

    /**
     * Update a reason.
     * @param {Object} req - Express request object with reason ID in params and text in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated reason or error.
     */
    static async updateReason(req, res) {
        try {
            const { id: reasonID } = req.params;
            const { text } = req.body;
            if (!reasonID || !text) {
                logger.warn(`Update reason failed: Missing reasonID or text, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Reason ID and text are required' });
            }
            const reason = await ReasonService.updateItem(reasonID, text, req.user.userID);
            // Notify creator and manager of reason update
            await NotificationService.triggerNotification({
                event: 'reason:updated',
                data: { reasonID, text },
                metadata: { updatedBy: req.user.email },
            });
            logger.info(`Reason ${reasonID} updated by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(reason);
        } catch (error) {
            logger.error(`Update reason error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Failed to update reason' });
        }
    }

    /**
     * Delete a reason.
     * @param {Object} req - Express request object with reason ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Empty response or error.
     */
    static async deleteReason(req, res) {
        try {
            const { id: reasonID } = req.params;
            if (!reasonID) {
                logger.warn(`Delete reason failed: Missing reasonID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Reason ID is required' });
            }
            await ReasonService.deleteItem(reasonID, req.user.userID);
            // Notify creator and manager of reason deletion
            await NotificationService.triggerNotification({
                event: 'reason:deleted',
                data: { reasonID },
                metadata: { deletedBy: req.user.email },
            });
            logger.info(`Reason ${reasonID} deleted by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(204).send();
        } catch (error) {
            logger.error(`Delete reason error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Failed to delete reason' });
        }
    }
}

module.exports = ReasonController;