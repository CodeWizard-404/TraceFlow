require('dotenv').config();

async function initializeGoogleServices() {
    try {
        const requiredEnvVars = [
            'GOOGLE_MAPS_API_KEY',
            'GOOGLE_CALENDAR_CLIENT_ID',
            'GOOGLE_CALENDAR_CLIENT_SECRET',
            'GOOGLE_CALENDAR_REDIRECT_URI',
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'GOOGLE_REDIRECT_URI',
        ];
    } catch (error) {
        throw error;
    }
}

module.exports = { initializeGoogleServices };