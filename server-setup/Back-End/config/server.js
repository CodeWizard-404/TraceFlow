const fs = require('fs');
const https = require('https');
const mdns = require('mdns-js');
require('dotenv').config();

// Sets up the HTTP/HTTPS server and advertises it via mDNS
async function initializeServer(app) {
    const PORT = process.env.PORT;
    let server;

    if (process.env.NODE_ENV === 'production' && fs.existsSync('path/to/key.pem')) {
        const options = {
            key: fs.readFileSync('path/to/key.pem'),
            cert: fs.readFileSync('path/to/cert.pem'),
        };
        server = https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
            console.log(`${new Date().toISOString()} - HTTPS Server running on port ${PORT}`);
        });
    } else {
        server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`${new Date().toISOString()} - HTTP Server running on port ${PORT}`);
        });
    }

    const service = mdns.createAdvertisement(mdns.tcp('http'), PORT, {
        name: 'TraceFlow-backend',
        txt: { path: '/api' },
    });
    service.start();
    console.log(`${new Date().toISOString()} - mDNS service advertised as TraceFlow-backend`);

    return server;
}

module.exports = { initializeServer };