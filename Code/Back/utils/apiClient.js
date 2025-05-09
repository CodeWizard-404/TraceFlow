const axios = require('axios');
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

        return config;
    },
    (error) => {

        return Promise.reject(error);
    }
);

// Interceptor for response logging and retry logic
apiClient.interceptors.response.use(
    (response) => {

        return response;
    },
    async (error) => {
        const config = error.config;
        if (!config || !config.retry) {

            return Promise.reject(error);
        }

        config.retry -= 1;
        const delay = 1000 * (config.retryDelay || 1);

        if (error.response?.status === 429 || error.response?.status === 503) {

            await new Promise(resolve => setTimeout(resolve, delay));
            return apiClient(config);
        }

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