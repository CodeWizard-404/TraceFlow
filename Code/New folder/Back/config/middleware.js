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

function setupMiddleware(app) {
    app.use(logger.addRequestTracing);
    app.use(cors({ ...corsOptions, allowedHeaders: ['Content-Type', 'Authorization', 'X-Google-API-Key'] }));
    app.use(cookieParser());
    app.use(express.json());
    app.use(helmet());
    app.use(compression());

    app.get('/api/uploads/photos/:folder/:filename', async (req, res, next) => {
        const { folder, filename } = req.params;
        const filePath = path.join(__dirname, '../uploads/photos', folder, filename);

        try {
            // Check if the file exists
            await fs.access(filePath);

            // Serve the file
            res.sendFile(filePath, (err) => {
                if (err) {
                    next(err);
                } else {
                    throw new Error('File not found');
                }
            });
        } catch (error) {
            res.status(404).json({ error: 'File not found' });
        }
    });

    // Serve supplier files with token validation and download limit
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

            // Check if file has expired (7 days since first download)
            if (firstDownloadedAt && Date.now() - firstDownloadedAt > sevenDays) {

                await redisClient.del(fileKey);
                try {
                    await fs.unlink(fileData.filePath);
                } catch (err) {
                    throw new Error('Failed to delete expired file: ' + err.message);
                }
                return res.status(403).json({ error: 'File access expired' });
            }

            // Check if download limit is reached
            if (downloadCount >= maxDownloads) {
                await redisClient.del(fileKey);
                try {
                    await fs.unlink(fileData.filePath);
                } catch (err) {
                    throw new Error('Failed to delete file after download limit reached: ' + err.message);
                }
                return res.status(403).json({ error: 'Download limit reached' });
            }

            // Increment download count
            await redisClient.hincrby(fileKey, 'downloadCount', 1);

            // If this is the first download, set firstDownloadedAt and TTL
            if (downloadCount === 0) {
                const now = Date.now();
                await redisClient.hset(fileKey, 'firstDownloadedAt', now);
                await redisClient.expire(fileKey, 7 * 24 * 60 * 60); // 7 days in seconds
            }

            // Serve the file
            res.sendFile(fileData.filePath, (err) => {
                if (err) {
                    next(err);
                }
            });

            // Delete file and Redis entry if this was the last download
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
}

module.exports = { setupMiddleware };