const ReasonService = require('../services/reasonService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing reason operations with structured logging.
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const reasons = await ReasonService.getAllReasons();
            logger.info('Successfully fetched all reasons', {
                route: 'reasons',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { reasonCount: reasons.length }
            });
            return res.status(200).json(reasons);
        } catch (error) {
            logger.error('Failed to fetch all reasons', {
                route: 'reasons',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id: reasonID } = req.params;
            if (!reasonID) {
                logger.warn('Get reason failed: Missing reasonID', {
                    route: 'reasons',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Reason ID is required' });
            }
            const reason = await ReasonService.getItemById(reasonID);
            logger.info('Successfully fetched reason', {
                route: 'reasons',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { reasonID }
            });
            return res.status(200).json(reason);
        } catch (error) {
            logger.error('Failed to fetch reason', {
                route: 'reasons',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id: visitID } = req.params;
            if (!visitID) {
                logger.warn('Get reasons by visit failed: Missing visitID', {
                    route: 'reasons/visit',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const reasons = await ReasonService.getReasonsByVisitId(visitID);
            logger.info('Successfully fetched reasons by visit', {
                route: 'reasons/visit',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { visitID, reasonCount: reasons.length }
            });
            return res.status(200).json(reasons);
        } catch (error) {
            logger.error('Failed to fetch reasons by visit', {
                route: 'reasons/visit',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { text } = req.body;
            if (!text) {
                logger.warn('Create reason failed: Missing text', {
                    route: 'reasons',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Reason text is required' });
            }
            const reason = await ReasonService.createItem(text, actorID);
            await NotificationService.triggerNotification({
                event: 'reason:created',
                data: { reasonID: reason.reasonID, text },
                metadata: { createdBy: req.user.email }
            });
            logger.info('Successfully created reason', {
                route: 'reasons',
                method: req.method,
                url: req.originalUrl,
                status: 201,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { reasonID: reason.reasonID, text }
            });
            return res.status(201).json(reason);
        } catch (error) {
            logger.error('Failed to create reason', {
                route: 'reasons',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id: reasonID } = req.params;
            const { text } = req.body;
            if (!reasonID || !text) {
                logger.warn('Update reason failed: Missing reasonID or text', {
                    route: 'reasons',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Reason ID and text are required' });
            }
            const reason = await ReasonService.updateItem(reasonID, text, actorID);
            await NotificationService.triggerNotification({
                event: 'reason:updated',
                data: { reasonID, text },
                metadata: { updatedBy: req.user.email }
            });
            logger.info('Successfully updated reason', {
                route: 'reasons',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { reasonID, text }
            });
            return res.status(200).json(reason);
        } catch (error) {
            logger.error('Failed to update reason', {
                route: 'reasons',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
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
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id: reasonID } = req.params;
            if (!reasonID) {
                logger.warn('Delete reason failed: Missing reasonID', {
                    route: 'reasons',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Reason ID is required' });
            }
            await ReasonService.deleteItem(reasonID, actorID);
            await NotificationService.triggerNotification({
                event: 'reason:deleted',
                data: { reasonID },
                metadata: { deletedBy: req.user.email }
            });
            logger.info('Successfully deleted reason', {
                route: 'reasons',
                method: req.method,
                url: req.originalUrl,
                status: 204,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { reasonID }
            });
            return res.status(204).send();
        } catch (error) {
            logger.error('Failed to delete reason', {
                route: 'reasons',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 404).json({ error: error.message || 'Failed to delete reason' });
        }
    }
}

module.exports = ReasonController;