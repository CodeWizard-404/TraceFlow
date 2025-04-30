import Keycloak from 'keycloak-js';

const keycloakConfig = {
    url: import.meta.env.VITE_KEYCLOAK_URL, // http://localhost:8080
    realm: import.meta.env.VITE_REALM, // TraceFlow
    clientId: import.meta.env.VITE_CLIENT_ID, // traceflow-backend
};

const keycloak = new Keycloak(keycloakConfig);

export const initKeycloak = async (): Promise<void> => {
    try {
        await keycloak.init({
            onLoad: 'check-sso',
            checkLoginIframe: false,
            redirectUri: window.location.origin,
        });
    } catch (error) {
        console.error('Keycloak initialization failed:', error);
        throw error;
    }
};

export default keycloak;