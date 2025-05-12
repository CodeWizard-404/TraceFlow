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
};

/**
 * Controller for managing AI operations with structured logging.
 */
class AIController {
    /**
     * Format error responses consistently.
     * @param {Error} error - The error object.
     * @returns {Object} Formatted error response.
     */
    static formatError(error) {
        return {
            error: error.message || ERROR_MESSAGES.SERVER_ERROR,
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
                    metadata: { supervisorId, weekStart },
                });
                return res.status(200).json(cachedResult);
            }

            const suggestions = await AIService.generateTimesheetSuggestions(supervisorId, weekStart, criteria);
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
                metadata: { supervisorId, weekStart, suggestionCount: suggestions.length },
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
                metadata: { error: response.error },
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
                    metadata: { dataType },
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
                metadata: { dataType, anomalyCount: anomalies.length },
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
                metadata: { error: response.error },
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
                    metadata: { format },
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
                metadata: { format },
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
                metadata: { error: response.error },
            });

            return res.status(status).json(response);
        }
    }
}

module.exports = AIController;