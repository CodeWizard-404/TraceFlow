// apiClient.js
const axios = require('axios');
const cache = require('./cache');

const apiClient = axios.create({
    timeout: parseInt(process.env.API_TIMEOUT) || 30000,
    headers: { 'Content-Type': 'application/json' },
});

const ollamaApiClient = axios.create({
    baseURL: process.env.OLLAMA_API_URL,
    timeout: parseInt(process.env.OLLAMA_REQUEST_TIMEOUT) || 60000,
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

async function makeOllamaApiCall(method, endpoint, data = {}, config = {}) {
    const cacheInstance = await cache();
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const cacheKey = `ollama:${method}:${url}:${JSON.stringify(data)}`;

    if (method.toLowerCase() === 'get') {
        return await cacheInstance.getOrSet(cacheKey, async () => {
            const response = await ollamaApiClient({
                method,
                url,
                data,
                ...config,
                retry: parseInt(process.env.OLLAMA_MAX_RETRIES) || 3,
            });
            return response.data;
        }, 'ollama');
    }

    const response = await ollamaApiClient({
        method,
        url,
        data,
        ...config,
        retry: parseInt(process.env.OLLAMA_MAX_RETRIES) || 3,
    });
    return response.data;
}

module.exports = { apiClient, makeApiCall, makeOllamaApiCall };