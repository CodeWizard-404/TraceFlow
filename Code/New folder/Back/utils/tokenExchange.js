// utils/tokenExchange.js
const axios = require('axios');
require('dotenv').config();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';


async function getGoogleAccessToken(keycloakToken) {
    try {
        const response = await axios.post(
            `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
                subject_token: keycloakToken,
                subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
                requested_issuer: 'google',
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        return response.data.access_token;
    } catch (error) {
        throw new Error('Failed to obtain Google access token: ' + (error.message || 'Unknown error'));
    }
}

async function getKeycloakAdminToken() {
    const response = await axios.post(
        `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: process.env.KEYCLOAK_ADMIN_USER || 'admin',
            password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
        })
    );
    return response.data.access_token;
}

async function getGoogleAccessTokenForUser(userId, adminToken) {
    try {
        // Step 1: Exchange admin token for target user's Keycloak token
        const userTokenResponse = await axios.post(
            `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
                requested_subject: userId, // Target user's Keycloak ID
                subject_token: adminToken,
                subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const userKeycloakToken = userTokenResponse.data.access_token;

        // Step 2: Exchange user's Keycloak token for Google access token
        const googleTokenResponse = await axios.post(
            `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
                subject_token: userKeycloakToken,
                subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
                requested_issuer: 'google',
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        return googleTokenResponse.data.access_token;
    } catch (error) {
        throw new Error('Failed to obtain Google access token for user: ' + (error.message || 'Unknown error'));
    }
}

module.exports = { getGoogleAccessToken, getKeycloakAdminToken, getGoogleAccessTokenForUser };

module.exports = { getGoogleAccessToken };