const cors = require('cors');
const cookieParser = require('cookie-parser');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const { corsOptions } = require('./cors');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const { getRedisClient } = require('./redis');
const crypto = require('crypto');

function setupMiddleware(app) {
    // Set nonce for all requests
    app.use((req, res, next) => {
        req.locals = req.locals || {};
        req.locals.nonce = crypto.randomBytes(16).toString('base64');
        res.locals.nonce = req.locals.nonce; // Mirror to res.locals for consistency
        next();
    });

    app.use(logger.addRequestTracing);
    app.use(cors({ ...corsOptions, allowedHeaders: ['Content-Type', 'Authorization', 'X-Google-API-Key'] }));
    app.use(cookieParser());
    app.use(express.json());

    // Configure helmet with custom CSP
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "https://unpkg.com",
                        (req) => `'nonce-${req.locals.nonce}'`,
                    ],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "https://fonts.googleapis.com",
                    ],
                    fontSrc: [
                        "'self'",
                        "https://fonts.gstatic.com",
                    ],
                    imgSrc: ["'self'", "data:"],
                    connectSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    upgradeInsecureRequests: [],
                },
            },
            crossOriginResourcePolicy: { policy: "same-origin" }, // Fix CORP issue
        })
    );

    app.use(compression());

    app.get('/api/uploads/photos/:folder/:filename', async (req, res, next) => {
        const { folder, filename } = req.params;
        const filePath = path.join(__dirname, '../Uploads/photos', folder, filename);

        try {
            await fs.access(filePath);
            res.sendFile(filePath, (err) => {
                if (err) {
                    res.status(404).json({ error: 'File not found' });
                }
            });
        } catch (error) {
            res.status(404).json({ error: 'File not found' });
        }
    });

    app.get('/api/uploads/supplier_files/:filename', async (req, res, next) => {
        const { filename } = req.params;
        const { token } = req.query;

        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }

        try {
            const redisClient = getRedisClient();
            const fileKey = `file:${token}`;
            const fileData = await redisClient.hgetall(fileKey);

            if (!fileData || !fileData.filePath || fileData.fileName !== filename) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }

            const downloadCount = parseInt(fileData.downloadCount, 10) || 0;
            const maxDownloads = parseInt(fileData.maxDownloads, 10) || parseInt(process.env.MAX_FILE_DOWNLOADS, 10);
            const firstDownloadedAt = fileData.firstDownloadedAt ? parseInt(fileData.firstDownloadedAt, 10) : null;
            const sevenDays = 7 * 24 * 60 * 60 * 1000;

            if (firstDownloadedAt && Date.now() - firstDownloadedAt > sevenDays) {
                await redisClient.del(fileKey);
                try {
                    await fs.unlink(fileData.filePath);
                } catch (err) {
                    throw new Error('Failed to delete expired file: ' + err.message);
                }
                return res.status(403).json({ error: 'File access expired' });
            }

            if (downloadCount >= maxDownloads) {
                await redisClient.del(fileKey);
                try {
                    await fs.unlink(fileData.filePath);
                } catch (err) {
                    throw new Error('Failed to delete file after download limit reached: ' + err.message);
                }
                return res.status(403).json({ error: 'Download limit reached' });
            }

            await redisClient.hincrby(fileKey, 'downloadCount', 1);

            if (downloadCount === 0) {
                const now = Date.now();
                await redisClient.hset(fileKey, 'firstDownloadedAt', now);
                await redisClient.expire(fileKey, 7 * 24 * 60 * 60);
            }

            res.sendFile(fileData.filePath, (err) => {
                if (err) {
                    return res.status(404).json({ error: 'File not found' });
                }
            });

            if (downloadCount + 1 >= maxDownloads) {
                await redisClient.del(fileKey);
                try {
                    await fs.unlink(fileData.filePath);
                } catch (err) {
                    throw new Error('Failed to delete file after last download: ' + err.message);
                }
            }
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Serve favicon to prevent 404 and CORP issues
    app.get('/favicon.ico', (req, res) => {
        const faviconPath = path.join(__dirname, '../Templates/logo/Logo.png');
        res.set('Cross-Origin-Resource-Policy', 'same-origin');
        fs.access(faviconPath)
            .then(() => res.sendFile(faviconPath))
            .catch(() => res.status(204).end());
    });
}

module.exports = { setupMiddleware };