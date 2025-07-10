require('dotenv').config();
const logger = require('../utils/logger');

async function initializeAI() {
    try {
        logger.info('Initializing AI module', { service: 'ai' });
        const aiConfig = {
            apiUrl: process.env.OLLAMA_API_URL,
            modelName: process.env.OLLAMA_MODEL_NAME,
            apiKey: process.env.OLLAMA_API_KEY,
            requestTimeout: parseInt(process.env.OLLAMA_REQUEST_TIMEOUT),
            maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES),
            anomalyThreshold: parseFloat(process.env.OLLAMA_ANOMALY_THRESHOLD),
            timesheetMaxSuggestions: parseInt(process.env.OLLAMA_TIMESHEET_MAX_SUGGESTIONS),
        };
        logger.info('AI module initialized successfully', { service: 'ai', config: aiConfig });
        return aiConfig;
    } catch (error) {
        logger.error('Failed to initialize AI module', {
            error: error.message,
            stack: error.stack,
            service: 'ai',
        });
        throw error;
    }
}

module.exports = { initializeAI };