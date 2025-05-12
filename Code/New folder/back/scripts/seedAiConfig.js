const { AIConfig } = require('../models'); // Import from models/index.js
const logger = require('../utils/logger');

async function seedAiConfig() {
    try {
        logger.info('Seeding AI configuration', { service: 'ai' });
        await AIConfig.create({
            anomalyThreshold: parseFloat(process.env.OLLAMA_ANOMALY_THRESHOLD) || 0.95,
            timesheetMaxSuggestions: parseInt(process.env.OLLAMA_TIMESHEET_MAX_SUGGESTIONS) || 5,
            modelName: process.env.OLLAMA_MODEL_NAME || 'mistral',
        });
        logger.info('AI configuration seeded successfully', { service: 'ai' });
    } catch (error) {
        logger.error('Failed to seed AI configuration', {
            error: error.message,
            stack: error.stack,
            service: 'ai',
        });
        throw error;
    }
}

module.exports = seedAiConfig