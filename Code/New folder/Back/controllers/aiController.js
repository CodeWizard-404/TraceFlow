const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const AIService = require('../services/aiService');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    SERVER_ERROR: 'Something broke. Try again later.',
    INVALID_SUPERVISOR: 'Invalid supervisor ID.',
    INVALID_WEEK_START: 'Invalid week start date.',
    INVALID_DATA_TYPE: 'Invalid data type provided.',
    INVALID_FILTERS: 'Invalid report filters provided.',
    INVALID_FORMAT: 'Invalid report format. Use "pdf" or "excel".',
    INVALID_AI_CONFIG: 'Invalid AI configuration parameters.',
    AI_CONFIG_NOT_FOUND: 'AI configuration not found.',
    UNAUTHORIZED: 'Unauthorized to perform this action.',
    INVALID_MODEL_NAME: 'Invalid AI model name.',
    INVALID_THRESHOLD: 'Anomaly threshold must be between 0 and 1.',
    INVALID_MAX_SUGGESTIONS: 'Timesheet max suggestions must be a positive integer.'
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
     * Generate timesheet suggestions using AI.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with suggestions or error.
     */
    static async suggestTimesheet(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }

            const { supervisorId, weekStart, criteria } = req.body;
            const cacheKey = `ai_timesheet_${supervisorId}_${weekStart}`;
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) {
                logger.info('Returning cached timesheet suggestions', {
                    traceId: req.traceId,
                    route: 'ai/timesheet',
                    service: 'api',
                    status: 200,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: actorID,
                    metadata: { supervisorId, weekStart }
                });
                return res.status(200).json(cachedResult);
            }

            // Parse weekStart to extract weekNumber and year
            const weekStartDate = new Date(weekStart);
            if (isNaN(weekStartDate)) {
                throw Object.assign(new Error(ERROR_MESSAGES.INVALID_WEEK_START), { status: 400 });
            }
            const year = weekStartDate.getUTCFullYear();
            const jan4 = new Date(Date.UTC(year, 0, 4));
            const dayOfWeek = jan4.getUTCDay() || 7;
            const firstMonday = new Date(Date.UTC(year, 0, 4 - (dayOfWeek - 1)));
            const weekNumber = Math.floor((weekStartDate - firstMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;

            const suggestions = await AIService.generateTimesheetSuggestions(supervisorId, weekNumber, year, criteria);
            const result = { suggestions };
            cache.set(cacheKey, result, 60);

            logger.info('Successfully generated timesheet suggestions', {
                traceId: req.traceId,
                route: 'ai/timesheet',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { supervisorId, weekStart, suggestionCount: suggestions.length }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;

            logger.error('Failed to generate timesheet suggestions', {
                traceId: req.traceId,
                route: 'ai/timesheet',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error }
            });

            return res.status(status).json(response);
        }
    }

    /**
     * Detect anomalies in provided data using AI.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with anomalies or error.
     */
    static async detectAnomalies(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }

            const { dataType, data } = req.body;
            const cacheKey = `ai_anomaly_${dataType}_${JSON.stringify(data).slice(0, 100)}`;
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) {
                logger.info('Returning cached anomaly detection results', {
                    traceId: req.traceId,
                    route: 'ai/anomaly',
                    service: 'api',
                    status: 200,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: actorID,
                    metadata: { dataType }
                });
                return res.status(200).json(cachedResult);
            }

            const anomalies = await AIService.detectAnomalies(dataType, data);
            const result = { anomalies };
            cache.set(cacheKey, result, 60);

            logger.info('Successfully detected anomalies', {
                traceId: req.traceId,
                route: 'ai/anomaly',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { dataType, anomalyCount: anomalies.length }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;

            logger.error('Failed to detect anomalies', {
                traceId: req.traceId,
                route: 'ai/anomaly',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error }
            });

            return res.status(status).json(response);
        }
    }

    /**
     * Generate a report using AI.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with report or error.
     */
    static async generateReport(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }

            const { filters, format } = req.body;
            const cacheKey = `ai_report_${JSON.stringify(filters)}_${format}`;
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) {
                logger.info('Returning cached report', {
                    traceId: req.traceId,
                    route: 'ai/report',
                    service: 'api',
                    status: 200,
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userId: actorID,
                    metadata: { format }
                });
                return res.status(200).json(cachedResult);
            }

            const report = await AIService.generateReport(filters, format);
            const result = { report };
            cache.set(cacheKey, result, 60);

            logger.info('Successfully generated report', {
                traceId: req.traceId,
                route: 'ai/report',
                service: 'api',
                status: 200,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { format }
            });

            return res.status(200).json(result);
        } catch (error) {
            const response = AIController.formatError(error);
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;

            logger.error('Failed to generate report', {
                traceId: req.traceId,
                route: 'ai/report',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error }
            });

            return res.status(status).json(response);
        }
    }

    /**
     * Create a new AI configuration.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with created configuration or error.
     */
    static async createAIConfig(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }

            const { modelName, anomalyThreshold, timesheetMaxSuggestions, supervisorId } = req.body;
            const configData = { modelName, anomalyThreshold, timesheetMaxSuggestions, supervisorId };
            const cacheKey = `ai_config_${supervisorId || 'global'}`;

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
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;

            logger.error('Failed to create AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/create',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error }
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
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
            }

            const { configID } = req.params;
            const { modelName, anomalyThreshold, timesheetMaxSuggestions } = req.body;
            const updateData = { modelName, anomalyThreshold, timesheetMaxSuggestions };
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
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;

            logger.error('Failed to update AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/update',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error }
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
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
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
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;

            logger.error('Failed to retrieve AI configuration', {
                traceId: req.traceId,
                route: 'ai/config',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error }
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
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
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
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;

            logger.error('Failed to delete AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/delete',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error }
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
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
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
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;

            logger.error('Failed to retrieve AI configurations list', {
                traceId: req.traceId,
                route: 'ai/configs',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error }
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
                throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
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
            const status = error.message === ERROR_MESSAGES.MISSING_FIELDS ? 400 : error.status || 500;

            logger.error('Failed to test AI configuration', {
                traceId: req.traceId,
                route: 'ai/config/test',
                service: 'api',
                status,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userId: actorID,
                metadata: { error: response.error }
            });

            return res.status(status).json(response);
        }
    }
}

module.exports = AIController;