const ConfigurationService = require('../services/configurationService');
const logger = require('../utils/logger');

class ConfigurationController {
    // Get all configurations
    static async getAllConfigurations(req, res) {
        try {
            const configs = await ConfigurationService.getAllConfigurations();
            logger.info(`Fetched all configurations by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(configs);
        } catch (error) {
            logger.error(`Get all configurations error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve configurations' });
        }
    }

    // Get a single configuration by key
    static async getConfigurationByKey(req, res) {
        try {
            const { key } = req.params;
            if (!key) {
                logger.warn(`Get configuration by key failed: Missing key, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Configuration key is required' });
            }
            const config = await ConfigurationService.getConfigurationByKey(key);
            logger.info(`Fetched configuration ${key} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(config);
        } catch (error) {
            logger.error(`Get configuration by key error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 404).json({ error: error.message || 'Configuration not found' });
        }
    }

    // Update a configuration
    static async updateConfiguration(req, res) {
        try {
            const { key, value } = req.body;
            if (!key || value === undefined) {
                logger.warn(`Update configuration failed: Missing key or value, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Key and value are required' });
            }
            const { config, created } = await ConfigurationService.updateConfiguration(key, value, req.user.userID);
            logger.info(
                `${created ? 'Created' : 'Updated'} configuration ${key} by user ${req.user.userID}, IP: ${req.ip}`
            );
            return res.status(created ? 201 : 200).json(config);
        } catch (error) {
            logger.error(`Update configuration error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to update configuration' });
        }
    }
}

module.exports = ConfigurationController;