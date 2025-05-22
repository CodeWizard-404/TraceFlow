const vault = require('node-vault');
require('dotenv').config();

const options = {
    apiVersion: 'v1',
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
};

const vaultClient = vault(options);

class VaultService {
    static async storeRefreshToken(userId, refreshToken) {
        try {
            await vaultClient.write(`secret/data/google-calendar/${userId}`, {
                data: { refresh_token: refreshToken },
            });
        } catch (error) {
            throw new Error(`Failed to store refresh token in Vault: ${error.message}`);
        }
    }

    static async getRefreshToken(userId) {
        try {
            const result = await vaultClient.read(`secret/data/google-calendar/${userId}`);
            return result.data.data.refresh_token;
        } catch (error) {
            throw new Error(`Failed to get refresh token from Vault: ${error.message}`);
        }
    }
}

module.exports = VaultService;