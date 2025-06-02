const ChecklistService = require('../services/checklistService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Controller for managing checklist operations with structured logging.
 */
class ChecklistController {
    // --- Checklist Retrieval Methods ---

    /**
     * Get all checklists.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with checklists or error.
     */
    static async getAllChecklists(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const checklists = await ChecklistService.getAllChecklists();
            logger.info('Successfully fetched all checklists', {
                route: 'checklists',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { checklistCount: checklists.length }
            });
            return res.status(200).json(checklists);
        } catch (error) {
            logger.error('Failed to fetch all checklists', {
                route: 'checklists',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve checklists' });
        }
    }

    /**
     * Get a checklist by ID.
     * @param {Object} req - Express request object with checklist ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with checklist or error.
     */
    static async getChecklistByID(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id: checklistID } = req.params;
            if (!checklistID) {
                logger.warn('Get checklist failed: Missing checklistID', {
                    route: 'checklists',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Checklist ID is required' });
            }
            const checklist = await ChecklistService.getItemById(checklistID);
            logger.info('Successfully fetched checklist', {
                route: 'checklists',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { checklistID }
            });
            return res.status(200).json(checklist);
        } catch (error) {
            logger.error('Failed to fetch checklist', {
                route: 'checklists',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 404).json({ error: error.message || 'Checklist not found' });
        }
    }

    /**
     * Get checklists by visit ID.
     * @param {Object} req - Express request object with visit ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with checklists or error.
     */
    static async getChecklistsByVisitID(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id: visitID } = req.params;
            if (!visitID) {
                logger.warn('Get checklists by visit failed: Missing visitID', {
                    route: 'checklists/visit',
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
            const checklists = await ChecklistService.getChecklistsByVisitId(visitID);
            logger.info('Successfully fetched checklists by visit', {
                route: 'checklists/visit',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { visitID, checklistCount: checklists.length }
            });
            return res.status(200).json(checklists);
        } catch (error) {
            logger.error('Failed to fetch checklists by visit', {
                route: 'checklists/visit',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 404).json({ error: error.message || 'Checklists not found for visit' });
        }
    }

    // --- Checklist Modification Methods ---

    /**
     * Create a new checklist item.
     * @param {Object} req - Express request object with text in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created checklist or error.
     */
    static async createChecklist(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { text } = req.body;
            if (!text) {
                logger.warn('Create checklist failed: Missing text', {
                    route: 'checklists',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Checklist text is required' });
            }
            const checklist = await ChecklistService.createItem(text, actorID);
            await NotificationService.triggerNotification({
                event: 'checklist:created',
                data: { checklistID: checklist.checklistID, text },
                metadata: { createdBy: req.user.email }
            });
            logger.info('Successfully created checklist', {
                route: 'checklists',
                method: req.method,
                url: req.originalUrl,
                status: 201,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { checklistID: checklist.checklistID, text }
            });
            return res.status(201).json(checklist);
        } catch (error) {
            logger.error('Failed to create checklist', {
                route: 'checklists',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to create checklist' });
        }
    }

    /**
     * Update a checklist item.
     * @param {Object} req - Express request object with checklist ID in params and text in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated checklist or error.
     */
    static async updateChecklist(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id: checklistID } = req.params;
            const { text } = req.body;
            if (!checklistID || !text) {
                logger.warn('Update checklist failed: Missing checklistID or text', {
                    route: 'checklists',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Checklist ID and text are required' });
            }
            const checklist = await ChecklistService.updateItem(checklistID, text, actorID);
            await NotificationService.triggerNotification({
                event: 'checklist:updated',
                data: { checklistID, text },
                metadata: { updatedBy: req.user.email }
            });
            logger.info('Successfully updated checklist', {
                route: 'checklists',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { checklistID, text }
            });
            return res.status(200).json(checklist);
        } catch (error) {
            logger.error('Failed to update checklist', {
                route: 'checklists',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 404).json({ error: error.message || 'Failed to update checklist' });
        }
    }

    /**
     * Delete a checklist item.
     * @param {Object} req - Express request object with checklist ID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} Empty response or error.
     */
    static async deleteChecklist(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { id: checklistID } = req.params;
            if (!checklistID) {
                logger.warn('Delete checklist failed: Missing checklistID', {
                    route: 'checklists',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Checklist ID is required' });
            }
            await ChecklistService.deleteItem(checklistID, actorID);
            await NotificationService.triggerNotification({
                event: 'checklist:deleted',
                data: { checklistID },
                metadata: { deletedBy: req.user.email }
            });
            logger.info('Successfully deleted checklist', {
                route: 'checklists',
                method: req.method,
                url: req.originalUrl,
                status: 204,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { checklistID }
            });
            return res.status(204).send();
        } catch (error) {
            logger.error('Failed to delete checklist', {
                route: 'checklists',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 404).json({ error: error.message || 'Failed to delete checklist' });
        }
    }
}

module.exports = ChecklistController;