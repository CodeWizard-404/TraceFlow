// utils/tokenExchange.js
const axios = require('axios');
require('dotenv').config();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'traceflow-backend';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';

async function getKeycloakAdminToken() {
    try {
        const response = await axios.post(
            `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token } = response.data;
        return access_token;
    } catch (error) {
        throw new Error(`Failed to retrieve Keycloak admin token: ${error.message}`);
    }
}

async function getGoogleAccessTokenForUser(keycloakUserId, adminToken) {
    try {
        const response = await axios.post(
            `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                subject_token: adminToken,
                requested_subject: keycloakUserId,
                requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token } = response.data;
        return access_token;
    } catch (error) {
        throw new Error(`Failed to exchange token for Google access: ${error.message}`);
    }
}


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

module.exports = { getGoogleAccessToken, getKeycloakAdminToken, getGoogleAccessTokenForUser };