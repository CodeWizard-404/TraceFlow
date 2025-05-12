const { makeOllamaApiCall } = require('../utils/apiClient');
const logger = require('../utils/logger');
const { initializeAI } = require('../config/ai');
const { AIConfig, User } = require('../models');

const ERROR_MESSAGES = {
    INVALID_SUPERVISOR: 'Invalid supervisor ID.',
    INVALID_WEEK_START: 'Invalid week start date.',
    INVALID_DATA_TYPE: 'Invalid data type provided.',
    INVALID_FILTERS: 'Invalid report filters provided.',
    INVALID_FORMAT: 'Invalid report format. Use "pdf" or "excel".',
    AI_API_UNAVAILABLE: 'AI service is unavailable. Try again later.',
    DATABASE_ERROR: 'Database issue. Try again.',
};

/**
 * Service for handling AI-related operations.
 */
class AIService {
    /**
     * Generate timesheet suggestions using the AI model.
     * @param {string} supervisorId - The supervisor's user ID.
     * @param {string} weekStart - The start date of the week (YYYY-MM-DD).
     * @param {Object} criteria - Additional criteria for suggestions.
     * @returns {Promise<Array>} List of timesheet suggestions.
     */
    static async generateTimesheetSuggestions(supervisorId, weekStart, criteria) {
        try {
            // Validate supervisor
            const supervisor = await User.findByPk(supervisorId);
            if (!supervisor) {
                const error = new Error(ERROR_MESSAGES.INVALID_SUPERVISOR);
                error.status = 404;
                throw error;
            }

            // Validate weekStart date
            if (!weekStart || isNaN(Date.parse(weekStart))) {
                const error = new Error(ERROR_MESSAGES.INVALID_WEEK_START);
                error.status = 400;
                throw error;
            }

            const aiConfig = await initializeAI();
            const config = (await AIConfig.findOne({ where: { supervisorId } })) || aiConfig;
            const prompt = `Generate up to ${config.timesheetMaxSuggestions} timesheet suggestions for supervisor ${supervisorId} for the week starting ${weekStart}. Consider: ${JSON.stringify(criteria)}. Optimize based on agent locations and weekly targets.`;

            const response = await makeOllamaApiCall('post', '/generate', { model: config.modelName, prompt });
            const suggestions = JSON.parse(response.output);

            logger.info('Timesheet suggestions generated', {
                service: 'ai',
                metadata: { supervisorId, weekStart, suggestionCount: suggestions.length },
            });

            return suggestions;
        } catch (error) {
            logger.error('Failed to generate timesheet suggestions', {
                error: error.message,
                stack: error.stack,
                service: 'ai',
                metadata: { supervisorId, weekStart },
            });
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503 });
        }
    }

    /**
     * Detect anomalies in the provided data using the AI model.
     * @param {string} dataType - Type of data (e.g., timesheet, visit).
     * @param {Array} data - Data to analyze.
     * @returns {Promise<Array>} List of detected anomalies.
     */
    static async detectAnomalies(dataType, data) {
        try {
            // Validate dataType
            const validDataTypes = ['timesheet', 'visit', 'receipt'];
            if (!dataType || !validDataTypes.includes(dataType)) {
                const error = new Error(ERROR_MESSAGES.INVALID_DATA_TYPE);
                error.status = 400;
                throw error;
            }

            // Validate data
            if (!Array.isArray(data) || data.length === 0) {
                const error = new Error('Data must be a non-empty array');
                error.status = 400;
                throw error;
            }

            const aiConfig = await initializeAI();
            const config = (await AIConfig.findOne()) || aiConfig;
            const prompt = `Analyze ${dataType} data: ${JSON.stringify(data)}. Detect anomalies with a confidence threshold of ${config.anomalyThreshold}. Return a list of anomalies with explanations.`;

            const response = await makeOllamaApiCall('post', '/generate', { model: config.modelName, prompt });
            const anomalies = JSON.parse(response.output);

            logger.info('Anomalies detected', {
                service: 'ai',
                metadata: { dataType, anomalyCount: anomalies.length },
            });

            return anomalies;
        } catch (error) {
            logger.error('Failed to detect anomalies', {
                error: error.message,
                stack: error.stack,
                service: 'ai',
                metadata: { dataType },
            });
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503 });
        }
    }

    /**
     * Generate a report using the AI model.
     * @param {Object} filters - Filters for the report (e.g., date range, regions).
     * @param {string} format - Report format (pdf or excel).
     * @returns {Promise<Object>} Generated report data.
     */
    static async generateReport(filters, format) {
        try {
            // Validate filters
            if (!filters || typeof filters !== 'object') {
                const error = new Error(ERROR_MESSAGES.INVALID_FILTERS);
                error.status = 400;
                throw error;
            }

            // Validate format
            const validFormats = ['pdf', 'excel'];
            if (!format || !validFormats.includes(format)) {
                const error = new Error(ERROR_MESSAGES.INVALID_FORMAT);
                error.status = 400;
                throw error;
            }

            const aiConfig = await initializeAI();
            const prompt = `Generate a ${format} report based on filters: ${JSON.stringify(filters)}. Include summaries and visualizations where applicable.`;

            const response = await makeOllamaApiCall('post', '/generate', { model: aiConfig.modelName, prompt });
            const report = JSON.parse(response.output);

            logger.info('Report generated', {
                service: 'ai',
                metadata: { format },
            });

            return report;
        } catch (error) {
            logger.error('Failed to generate report', {
                error: error.message,
                stack: error.stack,
                service: 'ai',
                metadata: { format },
            });
            throw error.message in ERROR_MESSAGES
                ? error
                : Object.assign(new Error(ERROR_MESSAGES.AI_API_UNAVAILABLE), { status: 503 });
        }
    }
}

module.exports = AIService;