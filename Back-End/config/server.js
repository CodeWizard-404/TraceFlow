const fs = require('fs');
const https = require('https');
const mdns = require('mdns-js');
require('dotenv').config();

// Sets up the HTTP/HTTPS server and advertises it via mDNS
async function initializeServer(app) {
    const PORT = process.env.PORT;
    let server;

    console.log(`${new Date().toISOString()} - Checking server environment...`);
    if (process.env.NODE_ENV === 'production' && fs.existsSync('path/to/key.pem')) {
        console.log(`${new Date().toISOString()} - Starting HTTPS server in production mode...`);
        const options = {
            key: fs.readFileSync('path/to/key.pem'),
            cert: fs.readFileSync('path/to/cert.pem'),
        };
        server = https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
            console.log(`${new Date().toISOString()} - HTTPS Server running on port ${PORT}`);
        });
    } else {
        console.log(`${new Date().toISOString()} - Starting HTTP server (development mode or no SSL certs)...`);
        server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`${new Date().toISOString()} - HTTP Server running on port ${PORT}`);
        });
    }

    console.log(`${new Date().toISOString()} - Setting up mDNS advertisement...`);
    const service = mdns.createAdvertisement(mdns.tcp('http'), PORT, {
        name: 'visit-management-backend',
        txt: { path: '/api' },
    });
    service.start();
    console.log(`${new Date().toISOString()} - mDNS service advertised as visit-management-backend`);

    return server;
}

module.exports = { initializeServer };