const vault = require('node-vault');
require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

const options = {
    apiVersion: 'v1',
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
};

const vaultClient = vault(options);

class VaultService {
    static async storeTokens(userId, accessToken, refreshToken, expiresIn) {
        if (typeof userId !== 'string') {
            logger.error('Invalid userId type', { userId: String(userId) });
            throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
        }
        try {
            const response = await vaultClient.write(`secret/data/google-calendar/${userId}`, {
                data: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    expires_at: Date.now() + expiresIn * 1000,
                },
            });
            logger.info('Stored tokens in Vault', { userId, vaultResponse: response.status });
        } catch (error) {
            logger.error('Failed to store tokens in Vault', {
                userId,
                error: error.message,
                vaultError: error.response?.data || error
            });
            throw new Error(`Failed to store tokens in Vault: ${error.message}`);
        }
    }

    static async getAccessToken(userId) {
        if (typeof userId !== 'string') {
            logger.error('Invalid userId type', { userId: String(userId) });
            throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
        }
        try {
            const result = await vaultClient.read(`secret/data/google-calendar/${userId}`);
            const { access_token, expires_at, refresh_token } = result.data.data;
            if (!access_token || !refresh_token) {
                logger.error('Missing access_token or refresh_token in Vault', { userId });
                throw new Error('Missing access_token or refresh_token in Vault');
            }
            // Check if access token is expired
            if (Date.now() >= expires_at) {
                logger.info('Access token expired, refreshing', { userId });
                const newAccessToken = await this.refreshAccessToken(userId, refresh_token);
                return newAccessToken;
            }
            logger.info('Retrieved valid access token from Vault', { userId });
            return access_token;
        } catch (error) {
            logger.error('Failed to get access token from Vault', {
                userId,
                error: error.message,
                vaultError: error.response?.data || error
            });
            throw new Error(`Failed to get access token from Vault: ${error.message}`);
        }
    }

    static async getRefreshToken(userId) {
        if (typeof userId !== 'string') {
            logger.error('Invalid userId type', { userId: String(userId) });
            throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
        }
        try {
            const result = await vaultClient.read(`secret/data/google-calendar/${userId}`);
            const refresh_token = result.data.data.refresh_token;
            if (!refresh_token) {
                logger.error('No refresh token found in Vault', { userId });
                throw new Error('No refresh token found in Vault');
            }
            logger.info('Retrieved refresh token from Vault', { userId });
            return refresh_token;
        } catch (error) {
            logger.error('Failed to get refresh token from Vault', {
                userId,
                error: error.message,
                vaultError: error.response?.data || error
            });
            throw new Error(`Failed to get refresh token from Vault: ${error.message}`);
        }
    }

    static async refreshAccessToken(userId, refreshToken) {
        if (typeof userId !== 'string') {
            logger.error('Invalid userId type', { userId: String(userId) });
            throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
        }
        if (typeof refreshToken !== 'string') {
            logger.error('Invalid refreshToken type', { userId, refreshToken: String(refreshToken) });
            throw new Error(`Invalid refreshToken type: expected string, got ${typeof refreshToken}`);
        }
        try {
            const response = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            });
            const { access_token, expires_in } = response.data;
            const expires_at = Date.now() + expires_in * 1000;
            await this.storeTokens(userId, access_token, refreshToken, expires_at);
            logger.info(`Refreshed Google access token`, { userId });
            return access_token;
        } catch (error) {
            logger.error(`Failed to refresh Google access token: ${error.response?.data?.error || error.message}`, {
                userId,
                errorDetails: error.response?.data || error
            });
            throw new Error(`Failed to refresh Google access token: ${error.response?.data?.error || error.message}`);
        }
    }
}

module.exports = VaultService;