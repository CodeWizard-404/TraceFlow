const axios = require('axios');
const cache = require('./cache');

const apiClient = axios.create({
    timeout: parseInt(process.env.API_TIMEOUT) || 30000,
    headers: { 'Content-Type': 'application/json' },
});

async function makeApiCall(method, url, data = {}, config = {}) {
    const cacheInstance = await cache();
    if (method.toLowerCase() === 'get') {
        const cacheKey = `api:${url}`;
        return await cacheInstance.getOrSet(cacheKey, async () => {
            const response = await apiClient({ method, url, data, ...config, retry: 3 });
            return response.data;
        }, 'api');
    }

    const response = await apiClient({ method, url, data, ...config, retry: 3 });
    return response.data;
}

module.exports = { apiClient, makeApiCall };