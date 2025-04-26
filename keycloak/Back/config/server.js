const fs = require('fs');
const https = require('https');
const http = require('http');
const mdns = require('mdns-js');
require('dotenv').config();

// Sets up the HTTP/HTTPS server, attaches Socket.IO, and advertises via mDNS
async function initializeServer(app, io) {
    const PORT = process.env.PORT || 5000;
    let server;

    if (process.env.NODE_ENV === 'production' && fs.existsSync(process.env.SSL_KEY_PATH)) {
        const options = {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH),
        };
        server = https.createServer(options, app);
    } else {
        server = http.createServer(app);
    }

    if (io) {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            process.env.FRONTEND_URL1,
        ];
        io.attach(server, {
            cors: {
                origin: allowedOrigins,
                methods: ['GET', 'POST'],
                credentials: true,
            },
        });
        console.log(`${new Date().toISOString()} - Socket.IO attached to server`);
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`${new Date().toISOString()} - ${process.env.NODE_ENV === 'production' ? 'HTTPS' : 'HTTP'} Server running on port ${PORT}`);
    });

    const service = mdns.createAdvertisement(mdns.tcp('http'), PORT, {
        name: 'TraceFlow-backend',
        txt: { path: '/api' },
    });
    service.start();
    console.log(`${new Date().toISOString()} - mDNS service advertised as TraceFlow-backend`);

    return server;
}

module.exports = { initializeServer };