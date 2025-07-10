const { validationResult } = require('express-validator');
const AIService = require('../services/aiService');
const NotificationService = require('../services/notificationService');
const { sequelize } = require('../config/db');
const Sequelize = require('sequelize');
const { getRedisClient } = require('../config/redis');
const RedisUtils = require('../utils/redisUtils');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');
const { logRequest } = require('../utils/controllerUtils');

const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    SERVER_ERROR: 'Something broke. Try again later.',
    INVALID_SUPERVISOR: 'Invalid supervisor ID.',
    INVALID_DATA_TYPE: 'Invalid data type provided.',
    INVALID_AI_CONFIG: 'Invalid AI configuration parameters.',
    AI_CONFIG_NOT_FOUND: 'AI configuration not found.',
    UNAUTHORIZED: 'Unauthorized to perform this action.',
    INVALID_MODEL_NAME: 'Invalid AI model name.',
    INVALID_THRESHOLD: 'Anomaly threshold must be between 0 and 1.'
};

class AIController {
    static formatError(error) {
        return {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
            details: error.details || undefined
        };
    }

    static async createAIConfig(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { modelName, anomalyThreshold, supervisorId, maxOptimizeRoute, timesheetMaxSuggestions } = req.body;
            const actorID = req.user?.userID || 'unknown';

            if (typeof modelName !== 'string' || !modelName.trim()) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_MODEL_NAME), { status: 400 });
            }

            let finalAnomalyThreshold;
            const defaultThreshold = parseFloat(process.env.OLLAMA_ANOMALY_THRESHOLD);
            if (isNaN(defaultThreshold) || defaultThreshold < 0 || defaultThreshold > 1) {
                await transaction.rollback();
                throw Object.assign(new Error('Invalid OLLAMA_ANOMALY_THRESHOLD in environment configuration'), { status: 500 });
            }

            finalAnomalyThreshold = (anomalyThreshold === undefined || anomalyThreshold === null)
                ? defaultThreshold
                : anomalyThreshold;

            if (anomalyThreshold !== undefined && anomalyThreshold !== null) {
                if (typeof anomalyThreshold !== 'number' || isNaN(anomalyThreshold) || anomalyThreshold < 0 || anomalyThreshold > 1) {
                    await transaction.rollback();
                    throw Object.assign(new Error(ERROR_MESSAGES.INVALID_THRESHOLD), { status: 400 });
                }
            }

            if (maxOptimizeRoute !== undefined && (!Number.isInteger(maxOptimizeRoute) || maxOptimizeRoute <= 0)) {
                await transaction.rollback();
                throw Object.assign(new Error('Invalid maxOptimizeRoute value'), { status: 400 });
            }

            if (timesheetMaxSuggestions !== undefined && (!Number.isInteger(timesheetMaxSuggestions) || timesheetMaxSuggestions <= 0)) {
                await transaction.rollback();
                throw Object.assign(new Error('Invalid timesheetMaxSuggestions value'), { status: 400 });
            }

            const configData = {
                modelName,
                anomalyThreshold: finalAnomalyThreshold,
                supervisorId,
                maxOptimizeRoute,
                timesheetMaxSuggestions
            };

            const config = await AIService.createAIConfig(configData, actorID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            const cacheKey = `ai_config_${supervisorId || 'global'}`;
            await cacheInstance.set(cacheKey, config, 60);
            await cacheInstance.invalidateByTag('ai_configs');
            await redis.set('ai_configs:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'ai_configs');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'ai_config:created',
                data: { configID: config.configID, modelName, supervisorId },
                metadata: { createdBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'ai_config',
                customMessage: `AI configuration ${config.configID} created by user ${actorID}`,
                requestID,
            });

            logRequest({
                req,
                res: config,
                status: 201,
                message: `Created AI configuration ${config.configID}`,
                level: 'info',
                metadata: { configID: config.configID, supervisorId, requestID },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            await transaction.commit();
            return res.status(201).json(config);
        } catch (error) {
            await transaction.rollback();
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logRequest({
                req,
                error,
                status,
                message: `Failed to create AI configuration: ${response.error}`,
                level: 'error',
                metadata: { details: response.details },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            return res.status(status).json(response);
        }
    }

    static async updateAIConfig(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { configID } = req.params;
            const { modelName, anomalyThreshold, maxOptimizeRoute, timesheetMaxSuggestions } = req.body;
            const actorID = req.user?.userID || 'unknown';

            if (modelName !== undefined && (typeof modelName !== 'string' || !modelName.trim())) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_MODEL_NAME), { status: 400 });
            }

            let finalAnomalyThreshold = anomalyThreshold;
            if (anomalyThreshold === undefined || anomalyThreshold === null) {
                const defaultThreshold = parseFloat(process.env.OLLAMA_ANOMALY_THRESHOLD);
                if (isNaN(defaultThreshold) || defaultThreshold < 0 || defaultThreshold > 1) {
                    await transaction.rollback();
                    throw Object.assign(new Error('Invalid OLLAMA_ANOMALY_THRESHOLD in environment configuration'), { status: 500 });
                }
                finalAnomalyThreshold = defaultThreshold;
            } else {
                if (typeof anomalyThreshold !== 'number' || isNaN(anomalyThreshold) || anomalyThreshold < 0 || anomalyThreshold > 1) {
                    await transaction.rollback();
                    throw Object.assign(new Error(ERROR_MESSAGES.INVALID_THRESHOLD), { status: 400 });
                }
            }

            if (maxOptimizeRoute !== undefined && (!Number.isInteger(maxOptimizeRoute) || maxOptimizeRoute <= 0)) {
                await transaction.rollback();
                throw Object.assign(new Error('Invalid maxOptimizeRoute value'), { status: 400 });
            }

            if (timesheetMaxSuggestions !== undefined && (!Number.isInteger(timesheetMaxSuggestions) || timesheetMaxSuggestions <= 0)) {
                await transaction.rollback();
                throw Object.assign(new Error('Invalid timesheetMaxSuggestions value'), { status: 400 });
            }

            const updateData = {
                ...(modelName !== undefined && { modelName }),
                anomalyThreshold: finalAnomalyThreshold,
                ...(maxOptimizeRoute !== undefined && { maxOptimizeRoute }),
                ...(timesheetMaxSuggestions !== undefined && { timesheetMaxSuggestions })
            };

            const config = await AIService.updateAIConfig(configID, updateData, actorID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            const cacheKey = `ai_config_${configID}`;
            // Use getOrSet to store the config
            await cacheInstance.getOrSet(cacheKey, async () => config, 60);
            await cacheInstance.invalidateByTag('ai_configs');
            await redis.set('ai_configs:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'ai_configs');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'ai_config:updated',
                data: { configID, modelName },
                metadata: { updatedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'ai_config',
                customMessage: `AI configuration ${configID} updated by user ${actorID}`,
                requestID,
            });

            logRequest({
                req,
                res: config,
                status: 200,
                message: `Updated AI configuration ${configID}`,
                level: 'info',
                metadata: { configID, requestID },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            await transaction.commit();
            return res.status(200).json(config);
        } catch (error) {
            await transaction.rollback();
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logRequest({
                req,
                error,
                status,
                message: `Failed to update AI configuration: ${response.error}`,
                level: 'error',
                metadata: { details: response.details },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            return res.status(status).json(response);
        }
    }

    static async getAIConfig(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { configID, supervisorId } = req.query;
            const actorID = req.user?.userID || 'unknown';
            const params = { configID, supervisorId };
            const cacheKey = `ai_config_${configID || supervisorId || 'global'}`;

            const cacheInstance = await cache();
            const config = await cacheInstance.getOrSet(cacheKey, async () => {
                return await AIService.getAIConfig(params, actorID);
            }, 'api');

            logRequest({
                req,
                res: config,
                status: 200,
                message: `Retrieved AI configuration`,
                level: 'info',
                metadata: { configID: config.configID, supervisorId },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            return res.status(200).json(config);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logRequest({
                req,
                error,
                status,
                message: `Failed to retrieve AI configuration: ${response.error}`,
                level: 'error',
                metadata: { details: response.details },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            return res.status(status).json(response);
        }
    }

    static async deleteAIConfig(req, res) {
        const transaction = await sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED });
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                await transaction.rollback();
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { configID } = req.params;
            const actorID = req.user?.userID || 'unknown';

            const result = await AIService.deleteAIConfig(configID, actorID, { transaction });

            const cacheInstance = await cache();
            const redis = getRedisClient();
            const cacheKey = `ai_config_${configID}`;
            await cacheInstance.del(cacheKey);
            await cacheInstance.invalidateByTag('ai_configs');
            await redis.set('ai_configs:last_updated', Date.now().toString());
            await RedisUtils.publishEvent('cache:invalidate', 'ai_configs');

            const requestID = uuidv4();
            await NotificationService.triggerNotification({
                event: 'ai_config:deleted',
                data: { configID },
                metadata: { deletedBy: req.user?.email || 'unknown' },
                dynamicRecipients: [],
                triggeredByUserID: actorID,
                type: 'ai_config',
                customMessage: `AI configuration ${configID} deleted by user ${actorID}`,
                requestID,
            });

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Deleted AI configuration ${configID}`,
                level: 'info',
                metadata: { configID, requestID },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            await transaction.commit();
            return res.status(200).json(result);
        } catch (error) {
            await transaction.rollback();
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logRequest({
                req,
                error,
                status,
                message: `Failed to delete AI configuration: ${response.error}`,
                level: 'error',
                metadata: { details: response.details },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            return res.status(status).json(response);
        }
    }

    static async listAIConfigs(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { supervisorId } = req.query;
            const actorID = req.user?.userID || 'unknown';
            const params = { supervisorId };
            const cacheKey = `ai_configs_${supervisorId || 'all'}`;

            const cacheInstance = await cache();
            const configs = await cacheInstance.getOrSet(cacheKey, async () => {
                return await AIService.listAIConfigs(params, actorID);
            }, 'api');

            logRequest({
                req,
                res: configs,
                status: 200,
                message: `Retrieved ${configs.length} AI configurations`,
                level: 'info',
                metadata: { supervisorId, configCount: configs.length },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            return res.status(200).json(configs);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logRequest({
                req,
                error,
                status,
                message: `Failed to retrieve AI configurations: ${response.error}`,
                level: 'error',
                metadata: { details: response.details },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            return res.status(status).json(response);
        }
    }

    static async testAIConfig(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { configID } = req.params;
            const actorID = req.user?.userID || 'unknown';

            const result = await AIService.testAIConfig(configID, actorID);

            logRequest({
                req,
                res: result,
                status: 200,
                message: `Tested AI configuration ${configID}`,
                level: 'info',
                metadata: { configID },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logRequest({
                req,
                error,
                status,
                message: `Failed to test AI configuration: ${response.error}`,
                level: 'error',
                metadata: { details: response.details },
                service: 'ai',
                defaultRoute: 'ai/config'
            });

            return res.status(status).json(response);
        }
    }
}

module.exports = AIController;