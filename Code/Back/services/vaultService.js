const vault = require('node-vault');
require('dotenv').config();
const axios = require('axios');
const { google } = require('googleapis');
const { User } = require('../models');

const options = {
    apiVersion: 'v1',
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
};

const vaultClient = vault(options);

class VaultService {
    static async storeTokens(userId, accessToken, refreshToken, expiresIn) {
        if (typeof userId !== 'string') {
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
        } catch (error) {

            throw new Error(`Failed to store tokens in Vault: ${error.message}`);
        }
    }

    static async getAccessToken(userId) {
        if (typeof userId !== 'string') {
            throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
        }
        try {
            const result = await vaultClient.read(`secret/data/google-calendar/${userId}`);
            const { access_token, expires_at, refresh_token } = result.data.data;
            if (!access_token || !refresh_token) {
                await this.clearTokens(userId);
                throw new Error('Missing access_token or refresh_token in Vault');
            }
            if (Date.now() >= expires_at) {
                return await this.refreshAccessToken(userId, refresh_token);
            }
            const isValid = await this.validateAccessToken(userId, access_token);
            if (!isValid) {
                return await this.refreshAccessToken(userId, refresh_token);
            }
            return access_token;
        } catch (error) {
            await this.clearTokens(userId);
            if (error.response?.status === 404) {
                throw new Error('No Google Calendar tokens found for this user in Vault');
            }
            throw new Error(`Failed to get access token from Vault: ${error.message}`);
        }
    }

    static async validateAccessToken(userId, accessToken) {
        try {
            const oauth2Client = new google.auth.OAuth2();
            oauth2Client.setCredentials({ access_token: accessToken });
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            // Test token by listing calendars (minimal API call)
            await calendar.calendarList.list();
            return true;
        } catch (error) {
            return false;
        }
    }

    static async getRefreshToken(userId) {
        if (typeof userId !== 'string') {
            throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
        }
        try {
            const result = await vaultClient.read(`secret/data/google-calendar/${userId}`);
            const refresh_token = result.data.data.refresh_token;
            if (!refresh_token) {
                await this.clearTokens(userId);
                throw new Error('No refresh token found in Vault');
            }
            return refresh_token;
        } catch (error) {

            await this.clearTokens(userId);
            throw new Error(`Failed to get refresh token from Vault: ${error.message}`);
        }
    }

    static async refreshAccessToken(userId, refreshToken) {
        if (typeof userId !== 'string') {
            throw new Error(`Invalid userId type: expected string, got ${typeof userId}`);
        }
        if (typeof refreshToken !== 'string') {
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
            return access_token;
        } catch (error) {
            await this.clearTokens(userId);
            throw new Error(`Failed to refresh Google access token: ${error.response?.data?.error || error.message}`);
        }
    }

    static async clearTokens(userId) {
        try {
            await vaultClient.delete(`secret/data/google-calendar/${userId}`);
            await User.update(
                { hasCalendarAccess: false },
                { where: { userID: userId } }
            );
        } catch (error) {
            throw new Error(`Failed to clear tokens from Vault: ${error.message}`);

        }
    }
}

module.exports = VaultService;