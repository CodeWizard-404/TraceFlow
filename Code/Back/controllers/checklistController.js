const ChecklistService = require('../services/checklistService');
const NotificationService = require('../services/notificationService');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');

/**
 * Controller for managing checklist operations with structured logging and notifications.
 */
class ChecklistController {
    // --- Checklist Retrieval Methods ---

    static async getAllChecklists(req, res) {
        try {
            const cacheInstance = await cache();
            const checklists = await cacheInstance.getOrSet('checklists:all', async () => {
                return await ChecklistService.getAllChecklists();
            }, 'api');

            logRequest({
                req,
                res: checklists,
                status: 200,
                message: `Retrieved ${checklists.length} checklists`,
                level: 'info',
                metadata: { checklistCount: checklists.length },
                service: 'checklist',
                defaultRoute: 'checklists'
            });

            return res.status(200).json(checklists);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to fetch checklists: ${error.message}`,
                level: 'error',
                service: 'checklist',
                defaultRoute: 'checklists'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve checklists' });
        }
    }

    static async getChecklistByID(req, res) {
        try {
            const { id: checklistID } = req.params;
            if (!checklistID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Checklist ID is required',
                    level: 'info',
                    service: 'checklist',
                    defaultRoute: 'checklists'
                });
                return res.status(400).json({ error: 'Checklist ID is required' });
            }

            const cacheInstance = await cache();
            const checklist = await cacheInstance.getOrSet(`checklist:${checklistID}`, async () => {
                return await ChecklistService.getItemById(checklistID);
            }, 'api');

            logRequest({
                req,
                res: checklist,
                status: 200,
                message: `Retrieved checklist ${checklistID}`,
                level: 'info',
                metadata: { checklistID },
                service: 'checklist',
                defaultRoute: 'checklists'
            });

            return res.status(200).json(checklist);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to fetch checklist: ${error.message}`,
                level: 'error',
                service: 'checklist',
                defaultRoute: 'checklists'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Checklist not found' });
        }
    }

    static async getChecklistsByVisitID(req, res) {
        try {
            const { id: visitID } = req.params;
            if (!visitID) {
                logRequest({
                    req,
                    status: 400,
                    message: 'Visit ID is required',
                    level: 'info',
                    service: 'checklist',
                    defaultRoute: 'checklists'
                });
                return res.status(400).json({ error: 'Visit ID is required' });
            }

            const cacheInstance = await cache();
            const checklists = await cacheInstance.getOrSet(`checklists:visit:${visitID}`, async () => {
                return await ChecklistService.getChecklistsByVisitId(visitID);
            }, 'api');

            logRequest({
                req,
                res: checklists,
                status: 200,
                message: `Retrieved ${checklists.length} checklists for visit ${visitID}`,
                level: 'info',
                metadata: { visitID, checklistCount: checklists.length },
                service: 'checklist',
                defaultRoute: 'checklists'
            });

            return res.status(200).json(checklists);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to fetch checklists by visit: ${error.message}`,
                level: 'error',
                service: 'checklist',
                defaultRoute: 'checklists'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Checklists not found for visit' });
        }
    }

    // --- Checklist Modification Methods ---

    static async createChecklist(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { text } = req.body;
            if (!text) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Checklist text is required',
                    level: 'info',
                    service: 'checklist',
                    defaultRoute: 'checklists'
                });
                return res.status(400).json({ error: 'Checklist text is required' });
            }

            const checklist = await ChecklistService.createItem(text, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('checklists');
            await cacheInstance.invalidate(`checklist:${checklist.checklistID}`);
            await redis.set('checklists:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'checklists');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'checklist:created',
                data: { checklistID: checklist.checklistID, text },
                metadata: { createdBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'checklist',
                customMessage: `Checklist item created`,
                requestID,
            });

            logRequest({
                req,
                res: checklist,
                status: 201,
                message: `Created checklist ${checklist.checklistID}`,
                level: 'info',
                metadata: { checklistID: checklist.checklistID, text, requestID },
                service: 'checklist',
                defaultRoute: 'checklists'
            });

            await transaction.commit();
            return res.status(201).json(checklist);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: `Failed to create checklist: ${error.message}`,
                level: 'error',
                service: 'checklist',
                defaultRoute: 'checklists'
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to create checklist' });
        }
    }

    static async updateChecklist(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { id: checklistID } = req.params;
            const { text } = req.body;
            if (!checklistID || !text) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Checklist ID and text are required',
                    level: 'info',
                    service: 'checklist',
                    defaultRoute: 'checklists'
                });
                return res.status(400).json({ error: 'Checklist ID and text are required' });
            }

            const checklist = await ChecklistService.updateItem(checklistID, text, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('checklists');
            await cacheInstance.invalidate(`checklist:${checklistID}`);
            await redis.set('checklists:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'checklists');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'checklist:updated',
                data: { checklistID, text },
                metadata: { updatedBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'checklist',
                customMessage: `Checklist item updated`,
                requestID,
            });

            logRequest({
                req,
                res: checklist,
                status: 200,
                message: `Updated checklist ${checklistID}`,
                level: 'info',
                metadata: { checklistID, text, requestID },
                service: 'checklist',
                defaultRoute: 'checklists'
            });

            await transaction.commit();
            return res.status(200).json(checklist);
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to update checklist: ${error.message}`,
                level: 'error',
                service: 'checklist',
                defaultRoute: 'checklists'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Failed to update checklist' });
        }
    }

    static async deleteChecklist(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const { id: checklistID } = req.params;
            if (!checklistID) {
                await transaction.rollback();
                logRequest({
                    req,
                    status: 400,
                    message: 'Checklist ID is required',
                    level: 'info',
                    service: 'checklist',
                    defaultRoute: 'checklists'
                });
                return res.status(400).json({ error: 'Checklist ID is required' });
            }


            await ChecklistService.deleteItem(checklistID, req.user.userID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            await cacheInstance.invalidateByTag('checklists');
            await cacheInstance.invalidate(`checklist:${checklistID}`);
            await redis.set('checklists:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'checklists');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'checklist:deleted',
                data: { checklistID },
                metadata: { deletedBy: req.user.email },
                dynamicRecipients: [],
                triggeredByUserID: req.user.userID,
                type: 'checklist',
                customMessage: `Checklist item deleted`,
                requestID,
            });

            logRequest({
                req,
                status: 204,
                message: `Deleted checklist ${checklistID}`,
                level: 'info',
                metadata: { checklistID, requestID },
                service: 'checklist',
                defaultRoute: 'checklists'
            });

            await transaction.commit();
            return res.status(204).send();
        } catch (error) {
            await transaction.rollback();
            logRequest({
                req,
                error,
                status: error.status || 404,
                message: `Failed to delete checklist: ${error.message}`,
                level: 'error',
                service: 'checklist',
                defaultRoute: 'checklists'
            });
            return res.status(error.status || 404).json({ error: error.message || 'Failed to delete checklist' });
        }
    }
}
module.exports = ChecklistController;