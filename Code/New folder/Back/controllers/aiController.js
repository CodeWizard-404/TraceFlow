const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const AIService = require('../services/aiService');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

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
    /**
     * Format error responses consistently.
     * @param {Error} error - The error object.
     * @returns {Object} Formatted error response.
     */
    static formatError(error) {
        return {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
            details: error.details || undefined
        };
    }

    /**
     * Create a new AI configuration.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created configuration or error.
     */
    static async createAIConfig(req, res) {
        console.log('Creating AI configuration', req.body);
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { modelName, anomalyThreshold, supervisorId, maxOptimizeRoute, timesheetMaxSuggestions } = req.body;

            // Validate modelName
            if (typeof modelName !== 'string' || !modelName.trim()) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_MODEL_NAME), { status: 400 });
            }

            // Handle anomalyThreshold: default to environment variable if not provided
            let finalAnomalyThreshold;
            const defaultThreshold = parseFloat(process.env.OLLAMA_ANOMALY_THRESHOLD);

            // Check if default threshold is valid
            if (isNaN(defaultThreshold) || defaultThreshold < 0 || defaultThreshold > 1) {
                throw Object.assign(new Error('Invalid OLLAMA_ANOMALY_THRESHOLD in environment configuration'), { status: 500 });
            }

            // If anomalyThreshold is not provided, use the default
            finalAnomalyThreshold = (anomalyThreshold === undefined || anomalyThreshold === null)
                ? defaultThreshold
                : anomalyThreshold;

            // Validate anomalyThreshold if provided in the request
            if (anomalyThreshold !== undefined && anomalyThreshold !== null) {
                if (typeof anomalyThreshold !== 'number' || isNaN(anomalyThreshold) || anomalyThreshold < 0 || anomalyThreshold > 1) {
                    throw Object.assign(new Error(ERROR_MESSAGES.INVALID_THRESHOLD), { status: 400 });
                }
            }

            // Validate maxOptimizeRoute
            if (maxOptimizeRoute !== undefined && (!Number.isInteger(maxOptimizeRoute) || maxOptimizeRoute <= 0)) {
                throw Object.assign(new Error('Invalid maxOptimizeRoute value'), { status: 400 });
            }

            // Validate timesheetMaxSuggestions
            if (timesheetMaxSuggestions !== undefined && (!Number.isInteger(timesheetMaxSuggestions) || timesheetMaxSuggestions <= 0)) {
                throw Object.assign(new Error('Invalid timesheetMaxSuggestions value'), { status: 400 });
            }

            // Prepare config data
            const configData = {
                modelName,
                anomalyThreshold: finalAnomalyThreshold,
                supervisorId,
                maxOptimizeRoute,
                timesheetMaxSuggestions
            };
            const cacheKey = `ai_config_${supervisorId || 'global'}`;

            // Create and cache the configuration
            const config = await AIService.createAIConfig(configData, actorID);
            cache.set(cacheKey, config, 60);

            logger.info('Successfully created AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/create',
                service: 'api',
                status: 201,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { configID: config.configID, supervisorId }
            });

            return res.status(201).json(config);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logger.error('Failed to create AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/create',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error, details: response.details }
            });

            return res.status(status).json(response);
        }
    }

    /**
     * Update an existing AI configuration.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated configuration or error.
     */
    static async updateAIConfig(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { configID } = req.params;
            const { modelName, anomalyThreshold, maxOptimizeRoute, timesheetMaxSuggestions } = req.body;

            // Validate modelName
            if (modelName !== undefined && (typeof modelName !== 'string' || !modelName.trim())) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_MODEL_NAME), { status: 400 });
            }

            // Handle anomalyThreshold: default to environment variable if not provided
            let finalAnomalyThreshold = anomalyThreshold;
            if (anomalyThreshold === undefined || anomalyThreshold === null) {
                const defaultThreshold = parseFloat(process.env.OLLAMA_ANOMALY_THRESHOLD);
                if (isNaN(defaultThreshold) || defaultThreshold < 0 || defaultThreshold > 1) {
                    throw Object.assign(new Error('Invalid OLLAMA_ANOMALY_THRESHOLD in environment configuration'), { status: 500 });
                }
                finalAnomalyThreshold = defaultThreshold;
            } else {
                if (typeof anomalyThreshold !== 'number' || isNaN(anomalyThreshold) || anomalyThreshold < 0 || anomalyThreshold > 1) {
                    throw Object.assign(new Error(ERROR_MESSAGES.INVALID_THRESHOLD), { status: 400 });
                }
            }

            // Validate maxOptimizeRoute
            if (maxOptimizeRoute !== undefined && (!Number.isInteger(maxOptimizeRoute) || maxOptimizeRoute <= 0)) {
                throw Object.assign(new Error('Invalid maxOptimizeRoute value'), { status: 400 });
            }

            // Validate timesheetMaxSuggestions
            if (timesheetMaxSuggestions !== undefined && (!Number.isInteger(timesheetMaxSuggestions) || timesheetMaxSuggestions <= 0)) {
                throw Object.assign(new Error('Invalid timesheetMaxSuggestions value'), { status: 400 });
            }

            const updateData = {
                ...(modelName !== undefined && { modelName }),
                anomalyThreshold: finalAnomalyThreshold,
                ...(maxOptimizeRoute !== undefined && { maxOptimizeRoute }),
                ...(timesheetMaxSuggestions !== undefined && { timesheetMaxSuggestions })
            };
            const cacheKey = `ai_config_${configID}`;

            const config = await AIService.updateAIConfig(configID, updateData, actorID);
            cache.set(cacheKey, config, 60);

            logger.info('Successfully updated AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/update',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { configID }
            });

            return res.status(200).json(config);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logger.error('Failed to update AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/update',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error, details: response.details }
            });

            return res.status(status).json(response);
        }
    }

    /**
     * Retrieve an AI configuration.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with configuration or error.
     */
    static async getAIConfig(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { configID, supervisorId } = req.query;
            const params = { configID, supervisorId };
            const cacheKey = `ai_config_${configID || supervisorId || 'global'}`;
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) {
                logger.info('Returning cached AI configuration', {
                    traceId: req.traceId,
                    route: 'ai/config',
                    service: 'api',
                    status: 200,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: actorID,
                    metadata: { configID, supervisorId }
                });
                return res.status(200).json(cachedResult);
            }

            const config = await AIService.getAIConfig(params, actorID);
            cache.set(cacheKey, config, 60);

            logger.info('Successfully retrieved AI configuration', {
                traceId: req.traceId,
                route: 'ai/config',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { configID: config.configID, supervisorId }
            });

            return res.status(200).json(config);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logger.error('Failed to retrieve AI configuration', {
                traceId: req.traceId,
                route: 'ai/config',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error, details: response.details }
            });

            return res.status(status).json(response);
        }
    }

    /**
     * Delete an AI configuration.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with deletion confirmation or error.
     */
    static async deleteAIConfig(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { configID } = req.params;
            const result = await AIService.deleteAIConfig(configID, actorID);
            cache.del(`ai_config_${configID}`);

            logger.info('Successfully deleted AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/delete',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { configID }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logger.error('Failed to delete AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/delete',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error, details: response.details }
            });

            return res.status(status).json(response);
        }
    }

    /**
     * List all AI configurations.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with list of configurations or error.
     */
    static async listAIConfigs(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { supervisorId } = req.query;
            const params = { supervisorId };
            const cacheKey = `ai_configs_${supervisorId || 'all'}`;
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) {
                logger.info('Returning cached AI configurations list', {
                    traceId: req.traceId,
                    route: 'ai/configs',
                    service: 'api',
                    status: 200,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: actorID,
                    metadata: { supervisorId }
                });
                return res.status(200).json(cachedResult);
            }

            const configs = await AIService.listAIConfigs(params, actorID);
            cache.set(cacheKey, configs, 60);

            logger.info('Successfully retrieved AI configurations list', {
                traceId: req.traceId,
                route: 'ai/configs',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { supervisorId, configCount: configs.length }
            });

            return res.status(200).json(configs);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logger.error('Failed to retrieve AI configurations list', {
                traceId: req.traceId,
                route: 'ai/configs',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error, details: response.details }
            });

            return res.status(status).json(response);
        }
    }

    /**
     * Test an AI configuration.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with test result or error.
     */
    static async testAIConfig(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw Object.assign(new Error(ERROR_MESSAGES.MISSING_FIELDS), { status: 400, details: errors.array() });
            }

            const { configID } = req.params;
            const result = await AIService.testAIConfig(configID, actorID);

            logger.info('Successfully tested AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/test',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { configID }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.status || 500;

            logger.error('Failed to test AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/test',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error, details: response.details }
            });

            return res.status(status).json(response);
        }
    }
}

module.exports = AIController;