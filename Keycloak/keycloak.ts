import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
    url: 'http://localhost:5173', // Proxy through frontend
    realm: 'TraceFlow',
    clientId: 'traceflow-frontend',
});

let initPromise: Promise<boolean> | null = null;

export const initializeKeycloak = () => {
    if (!initPromise) {
        console.log('Initializing Keycloak...');
        initPromise = keycloak.init({
            onLoad: 'login-required',
            checkLoginIframe: false,
        }).then((authenticated) => {
            console.log('Keycloak initialized successfully, authenticated:', authenticated);
            return authenticated;
        }).catch((error) => {
            console.error('Keycloak init failed with error:', error);
            throw error;
        });
    }
    return initPromise;
};

export default keycloak;