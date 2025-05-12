require('dotenv').config();
const logger = require('../utils/logger');

async function initializeAI() {
    try {
        logger.info('Initializing AI module', { service: 'ai' });
        const aiConfig = {
            apiUrl: process.env.OLLAMA_API_URL || 'http://localhost:11434/api',
            modelName: process.env.OLLAMA_MODEL_NAME || 'mistral',
            apiKey: process.env.OLLAMA_API_KEY || '',
            requestTimeout: parseInt(process.env.OLLAMA_REQUEST_TIMEOUT) || 60000,
            maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES) || 3,
            anomalyThreshold: parseFloat(process.env.OLLAMA_ANOMALY_THRESHOLD) || 0.95,
            timesheetMaxSuggestions: parseInt(process.env.OLLAMA_TIMESHEET_MAX_SUGGESTIONS) || 5,
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