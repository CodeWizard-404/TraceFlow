const VisitService = require('../services/visitService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing visit-related operations.
 */
class VisitController {
    // --- Visit Retrieval Methods ---

    /**
     * Get a visit by ID.
     * @param {Object} req - Express request object with visit ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with visit or error.
     */
    static async getVisitByID(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Get visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await VisitService.getVisitByID(id);
            logger.info(`Fetched visit ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(visit);
        } catch (error) {
            logger.error(`Get visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve visit' });
        }
    }

    // --- Visit Modification Methods ---

    /**
     * Verify a QR code for a visit.
     * @param {Object} req - Express request object with qrData and visitId in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with verification result or error.
     */
    static async verifyQRCode(req, res) {
        try {
            const { qrData, visitId } = req.body;
            if (!qrData || !visitId) {
                logger.warn(`Verify QR code failed: Missing qrData or visitId, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'qrData and visitId are required' });
            }
            const result = await VisitService.verifyQRCode(qrData, visitId, req.user.userID);
            if (result.valid) {
                // Notify supervisor of successful QR verification
                await NotificationService.triggerNotification({
                    event: 'visit:qr_verified',
                    data: { visitId, qrData },
                    metadata: { verifiedBy: req.user.email }
                });
            }
            logger.info(`QR code verified for visit ${visitId} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(result.valid ? 200 : 400).json(result);
        } catch (error) {
            logger.error(`QR verification error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to verify QR code' });
        }
    }

    /**
     * Log a visit with details.
     * @param {Object} req - Express request object with visit ID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with logged visit or error.
     */
    static async logVisit(req, res) {
        try {
            const { id } = req.params;
            const { duration, checklistUpdates, comment } = req.body;
            const files = req.files || [];
            if (!id) {
                logger.warn(`Log visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            if (!files || files.length === 0) {
                logger.warn(`Log visit failed: At least one photo is required to log a visit, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'At least one photo is required to log a visit' });
            }
            const visit = await VisitService.logVisit(id, { duration, checklistUpdates, comment }, files, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'visit:logged',
                data: { visitId: id, duration, comment },
                metadata: { loggedBy: req.user.email }
            });
            logger.info(`Visit ${id} logged by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(visit);
        } catch (error) {
            logger.error(`Log visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to log visit' });
        }
    }

    /**
     * Update a visit's details.
     * @param {Object} req - Express request object with visit ID in params and data in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated visit or error.
     */
    static async updateVisit(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const files = req.files || [];
            if (!id) {
                logger.warn(`Update visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await VisitService.updateVisit(id, data, files, req.user.userID);
            // Notify supervisor and manager of visit update
            await NotificationService.triggerNotification({
                event: 'visit:updated',
                data: { visitId: id, updates: Object.keys(data) },
                metadata: { updatedBy: req.user.email }
            });
            logger.info(`Updated visit ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(visit);
        } catch (error) {
            logger.error(`Update visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to update visit' });
        }
    }

    /**
     * Delete a visit.
     * @param {Object} req - Express request object with visit ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with result or error.
     */
    static async deleteVisit(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Delete visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const result = await VisitService.deleteVisit(id, req.user.userID);
            // Notify supervisor and manager of visit deletion
            await NotificationService.triggerNotification({
                event: 'visit:deleted',
                data: { visitId: id },
                metadata: { deletedBy: req.user.email }
            });
            logger.info(`Deleted visit ${id} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Delete visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to delete visit' });
        }
    }
}

module.exports = VisitController;