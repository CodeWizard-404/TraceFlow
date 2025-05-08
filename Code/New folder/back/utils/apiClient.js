const axios = require('axios');
const logger = require('./logger');
require('dotenv').config();

const apiClient = axios.create({
    timeout: parseInt(process.env.API_TIMEOUT) || 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor for request logging
apiClient.interceptors.request.use(
    (config) => {
        logger.debug(`API request: ${config.method.toUpperCase()} ${config.url}`, {
            params: config.params,
            timestamp: new Date().toISOString(),
        });
        return config;
    },
    (error) => {
        logger.error(`API request error: ${error.message}`, {
            stack: error.stack,
            timestamp: new Date().toISOString(),
        });
        return Promise.reject(error);
    }
);

// Interceptor for response logging and retry logic
apiClient.interceptors.response.use(
    (response) => {
        logger.debug(`API response: ${response.config.method.toUpperCase()} ${response.config.url} - ${response.status}`, {
            timestamp: new Date().toISOString(),
        });
        return response;
    },
    async (error) => {
        const config = error.config;
        if (!config || !config.retry) {
            logger.error(`API response error: ${error.message}`, {
                status: error.response?.status,
                data: error.response?.data,
                timestamp: new Date().toISOString(),
            });
            return Promise.reject(error);
        }

        config.retry -= 1;
        const delay = 1000 * (config.retryDelay || 1);

        if (error.response?.status === 429 || error.response?.status === 503) {
            logger.warn(`Retrying API request due to ${error.response.status}: ${config.method.toUpperCase()} ${config.url}`, {
                retriesLeft: config.retry,
                timestamp: new Date().toISOString(),
            });
            await new Promise(resolve => setTimeout(resolve, delay));
            return apiClient(config);
        }

        logger.error(`API response error: ${error.message}`, {
            status: error.response?.status,
            data: error.response?.data,
            timestamp: new Date().toISOString(),
        });
        return Promise.reject(error);
    }
);

// Function to make API calls with retry
async function makeApiCall(method, url, data = {}, config = {}) {
    try {
        const response = await apiClient({
            method,
            url,
            data,
            ...config,
            retry: config.retry || 3,
            retryDelay: config.retryDelay || 1,
        });
        return response.data;
    } catch (error) {
        throw new Error(`API call failed: ${error.message}`);
    }
}

module.exports = { apiClient, makeApiCall };