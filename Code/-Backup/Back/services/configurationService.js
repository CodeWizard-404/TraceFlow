const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

class ConfigurationService {
    // Path to the .env file
    static envFilePath = path.resolve(process.cwd(), '.env');

    // Helper to parse .env file into key-value pairs
    static async parseEnvFile() {
        try {
            const content = await fs.readFile(this.envFilePath, 'utf-8');
            const lines = content.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
            const configs = {};

            for (const line of lines) {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').trim();
                if (key && value) {
                    configs[key.trim()] = value;
                }
            }
            return configs;
        } catch (error) {
            logger.error(`Failed to parse .env file: ${error.message}`);
            const err = new Error('Failed to read configurations');
            err.status = 500;
            throw err;
        }
    }

    // Helper to write key-value pairs back to .env file
    static async writeEnvFile(configs) {
        try {
            const lines = [];
            for (const [key, value] of Object.entries(configs)) {
                lines.push(`${key}=${value}`);
            }
            const content = lines.join('\n');
            await fs.writeFile(this.envFilePath, content, 'utf-8');
        } catch (error) {
            logger.error(`Failed to write .env file: ${error.message}`);
            const err = new Error('Failed to update configurations');
            err.status = 500;
            throw err;
        }
    }

    // Get all configurations from .env
    static async getAllConfigurations() {
        try {
            const configs = await this.parseEnvFile();
            const result = Object.entries(configs).map(([key, value]) => ({
                key,
                value,
                description: 'Configuration from .env file',
                updatedAt: new Date(), // Note: .env doesn't store timestamps, so we use current time
            }));
            return result;
        } catch (error) {
            logger.error(`Get all configurations error: ${error.message}`);
            throw error;
        }
    }

    // Get a single configuration by key
    static async getConfigurationByKey(key) {
        try {
            if (!key) {
                const error = new Error('Configuration key is required');
                error.status = 400;
                throw error;
            }
            const configs = await this.parseEnvFile();
            if (!(key in configs)) {
                const error = new Error('Configuration not found');
                error.status = 404;
                throw error;
            }
            return {
                key,
                value: configs[key],
                description: 'Configuration from .env file',
                updatedAt: new Date(),
            };
        } catch (error) {
            logger.error(`Get configuration by key error: ${error.message}`);
            throw error;
        }
    }

    // Update or create a configuration in .env
    static async updateConfiguration(key, value, userID) {
        try {
            if (!key || value === undefined) {
                const error = new Error('Key and value are required');
                error.status = 400;
                throw error;
            }

            // Validate key and value to prevent breaking .env format
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
                const error = new Error('Invalid key format. Keys must be alphanumeric with underscores');
                error.status = 400;
                throw error;
            }

            const configs = await this.parseEnvFile();
            const created = !(key in configs);
            configs[key] = value;

            await this.writeEnvFile(configs);

            // Note: We don't store userID or updatedAt in .env, but we log them
            logger.info(`Configuration ${key} ${created ? 'created' : 'updated'} by user ${userID}`);

            return {
                config: {
                    key,
                    value,
                    description: 'Configuration from .env file',
                    updatedAt: new Date(),
                },
                created,
            };
        } catch (error) {
            logger.error(`Update configuration error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = ConfigurationService;