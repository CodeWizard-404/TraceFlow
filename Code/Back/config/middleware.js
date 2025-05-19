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

    // Serve supplier files with token validation and download limit
    app.get('/api/uploads/supplier_files/:filename', async (req, res, next) => {
        const { filename } = req.params;
        const { token } = req.query;

        if (!token) {
            logger.warn('Missing token for file access', {
                filename,
                ip: req.ip,
                service: 'file-access',
            });
            return res.status(401).json({ error: 'Token required' });
        }

        try {
            const redisClient = getRedisClient();
            const fileKey = `file:${token}`;
            const fileData = await redisClient.hgetall(fileKey);

            if (!fileData || !fileData.filePath || fileData.fileName !== filename) {
                logger.warn('Invalid or expired token', {
                    token,
                    filename,
                    ip: req.ip,
                    service: 'file-access',
                });
                return res.status(403).json({ error: 'Invalid or expired token' });
            }

            const downloadCount = parseInt(fileData.downloadCount, 10) || 0;
            const maxDownloads = parseInt(fileData.maxDownloads, 10) || parseInt(process.env.MAX_FILE_DOWNLOADS, 10);
            const firstDownloadedAt = fileData.firstDownloadedAt ? parseInt(fileData.firstDownloadedAt, 10) : null;
            const sevenDays = 7 * 24 * 60 * 60 * 1000;

            // Check if file has expired (7 days since first download)
            if (firstDownloadedAt && Date.now() - firstDownloadedAt > sevenDays) {
                logger.info('File access expired after 7 days, deleting file', {
                    filename,
                    token,
                    ip: req.ip,
                    service: 'file-access',
                });
                await redisClient.del(fileKey);
                try {
                    await fs.unlink(fileData.filePath);
                } catch (err) {
                    logger.error('Failed to delete expired file', {
                        filename,
                        error: err.message,
                        service: 'file-access',
                    });
                }
                return res.status(403).json({ error: 'File access expired' });
            }

            // Check if download limit is reached
            if (downloadCount >= maxDownloads) {
                logger.info('Download limit reached, deleting file', {
                    filename,
                    token,
                    ip: req.ip,
                    service: 'file-access',
                });
                await redisClient.del(fileKey);
                try {
                    await fs.unlink(fileData.filePath);
                } catch (err) {
                    logger.error('Failed to delete file after limit', {
                        filename,
                        error: err.message,
                        service: 'file-access',
                    });
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
                logger.info('First download, setting 7-day expiration', {
                    filename,
                    token,
                    firstDownloadedAt: new Date(now).toISOString(),
                    ip: req.ip,
                    service: 'file-access',
                });
            }

            logger.info('Serving supplier file', {
                filename,
                token,
                downloadCount: downloadCount + 1,
                maxDownloads,
                ip: req.ip,
                service: 'file-access',
            });

            // Serve the file
            res.sendFile(fileData.filePath, (err) => {
                if (err) {
                    logger.error('Error sending file', {
                        filename,
                        error: err.message,
                        ip: req.ip,
                        service: 'file-access',
                    });
                    next(err);
                }
            });

            // Delete file and Redis entry if this was the last download
            if (downloadCount + 1 >= maxDownloads) {
                logger.info('Last download, deleting file', {
                    filename,
                    token,
                    ip: req.ip,
                    service: 'file-access',
                });
                await redisClient.del(fileKey);
                try {
                    await fs.unlink(fileData.filePath);
                } catch (err) {
                    logger.error('Failed to delete file after last download', {
                        filename,
                        error: err.message,
                        service: 'file-access',
                    });
                }
            }
        } catch (error) {
            logger.error('Error processing file request', {
                filename,
                token,
                error: error.message,
                ip: req.ip,
                service: 'file-access',
            });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}

module.exports = { setupMiddleware };