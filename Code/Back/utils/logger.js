const winston = require('winston');
const { createLogger, format } = winston;
const { combine, timestamp, printf, colorize, json, metadata, errors } = format;
const { nanoid } = require('nanoid');
const CryptoJS = require('crypto-js');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const promClient = require('prom-client');
const path = require('path');
const fs = require('fs');

// Metrics Registry
const register = new promClient.Registry();
const logCounter = new promClient.Counter({
    name: 'app_log_total',
    help: 'Total logs by level, route, and service',
    labelNames: ['level', 'route', 'service'],
    registers: [register],
});
const logLatency = new promClient.Histogram({
    name: 'log_processing_duration_seconds',
    help: 'Log processing latency in seconds',
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 5],
    registers: [register],
});

// Rate Limiter
const rateLimiter = new RateLimiterMemory({
    points: parseInt(process.env.SENSITIVE_LIMITER_LOGS) || 1000,
    duration: (parseInt(process.env.SENSITIVE_LIMITER_WINDOW_MS) || 600000) / 1000, // 10 minutes
});

// Configuration from .env
const config = {
    logLevel: process.env.LOG_LEVEL || 'info',
    logSampleRate: parseFloat(process.env.LOG_SAMPLE_RATE) || 1,
    encryptionKey: process.env.LOG_SECRET || 'default-secret',
    batchSize: 100,
    batchInterval: 500,
    baseLogDir: path.join(__dirname, '../logs'),
};

// Route-specific log directories
const routeLogDirs = {
    auth: 'auth',
    users: 'users',
    roles: 'roles',
    permissions: 'permissions',
    visits: 'visits',
    checklists: 'checklists',
    reasons: 'reasons',
    timesheets: 'timesheets',
    agents: 'agents',
    'receipt-books': 'receipt-books',
    'receipt-stubs': 'receipt-stubs',
    notifications: 'notifications',
    locations: 'locations',
    'csv-headers': 'csv-headers',
    general: 'general',
};

// Create all log directories
Object.values(routeLogDirs).forEach((dir) => {
    const fullPath = path.join(config.baseLogDir, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

// Custom Database Transport
class RouteAwareDatabaseTransport extends winston.Transport {
    constructor(options) {
        super(options);
        this.name = 'routeAwareDatabase';
        this.batch = [];
        this.batchTimeout = null;
        this.batchSize = options.batchSize;
        this.batchInterval = options.batchInterval;
    }

    async log(info, callback) {
        const end = logLatency.startTimer();
        try {
            if (Math.random() > config.logSampleRate) {
                callback();
                return;
            }

            try {
                await rateLimiter.consume('db-log', 1);
            } catch (rateLimitError) {
                console.warn(`Rate limit exceeded for database logging: ${JSON.stringify(rateLimitError)}`);
                callback();
                return;
            }

            // Encrypt sensitive data in metadata
            const encryptedMetadata = { ...info.metadata };
            if (info.sensitiveFields) {
                info.sensitiveFields.forEach((field) => {
                    if (encryptedMetadata[field]) {
                        encryptedMetadata[field] = CryptoJS.AES.encrypt(
                            encryptedMetadata[field],
                            config.encryptionKey
                        ).toString();
                        encryptedMetadata[`${field}Encrypted`] = true;
                    }
                });
            }

            this.batch.push({
                level: info.level,
                message: info.message,
                ip: info.ip,
                metadata: encryptedMetadata,
                traceId: info.traceId || nanoid(),
                route: info.route || 'general',
                service: info.service || 'default',
                status: info.status || null,
                method: info.method,
                url: info.url,
                userId: info.userId,
                timestamp: info.timestamp || new Date(),
            });

            setImmediate(() => this.emit('logged', info));

            if (!this.batchTimeout && this.batch.length >= 1) {
                this.batchTimeout = setTimeout(() => this.flush(), this.batchInterval);
            }

            if (this.batch.length >= this.batchSize) {
                await this.flush();
            }

            callback();
        } catch (error) {
            console.error('Database logging error:', error.message);
            callback(error);
        } finally {
            end();
        }
    }

    async flush() {
        if (this.batch.length === 0) return;

        const batchToProcess = [...this.batch];
        this.batch = [];
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;

        try {
            const { Log } = require('../models');
            await Log.bulkCreate(batchToProcess);
        } catch (error) {
            console.error('Failed to flush logs to database:', error.message);
        }
    }
}

// Custom Route-aware File Transport
class RouteAwareFileTransport extends winston.Transport {
    constructor(options) {
        super(options);
        this.name = 'routeAwareFile';
        this.baseLogDir = options.baseLogDir || path.join(__dirname, '../logs');
    }

    log(info, callback) {
        const end = logLatency.startTimer();
        try {
            if (Math.random() > config.logSampleRate) {
                callback();
                return;
            }

            const routeDir = routeLogDirs[info.route] || 'general';
            const logDir = path.join(this.baseLogDir, routeDir);
            const logPath = path.join(logDir, `${routeDir}.log`);

            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            // Encrypt sensitive data in metadata
            const encryptedMetadata = { ...info.metadata };
            if (info.sensitiveFields) {
                info.sensitiveFields.forEach((field) => {
                    if (encryptedMetadata[field]) {
                        encryptedMetadata[field] = CryptoJS.AES.encrypt(
                            encryptedMetadata[field],
                            config.encryptionKey
                        ).toString();
                        encryptedMetadata[`${field}Encrypted`] = true;
                    }
                });
            }

            const logMessage = JSON.stringify({
                timestamp: info.timestamp,
                level: info.level,
                message: info.message,
                traceId: info.traceId,
                route: info.route,
                service: info.service,
                metadata: encryptedMetadata,
                status: info.status || null,
                ip: info.ip,
                method: info.method,
                url: info.url,
                userId: info.userId,
            }) + '\n';

            fs.appendFileSync(logPath, logMessage);
            setImmediate(() => this.emit('logged', info));
            callback();
        } catch (error) {
            console.error(`File logging error for route ${info.route}:`, error.message);
            callback();
        } finally {
            end();
        }
    }
}

// Custom Format
const structuredFormat = combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    metadata({ fillExcept: ['message', 'level', 'timestamp', 'ip', 'route', 'service', 'status', 'traceId', 'method', 'url', 'userId', 'sensitiveFields'] }),
    format((info) => {
        info.traceId = info.traceId || nanoid();
        info.route = info.route || 'general';
        info.service = info.service || 'default';
        info.status = info.status || null;
        return info;
    })(),
    json()
);

// Console Format
const consoleFormat = combine(
    colorize({
        all: true,
        colors: {
            error: 'red bold inverse',
            warn: 'yellow bold',
            info: 'cyan bold',
            debug: 'magenta',
            verbose: 'blue',
            trace: 'gray',
        },
    }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    printf(({ level, message, timestamp, traceId, route, service, status, method, url, userId, sensitiveFields, ...metadata }) => {
        const metadataStr = Object.keys(metadata).length
            ? ` | Metadata: ${JSON.stringify(metadata)}`
            : '';
        const statusStr = status ? ` | Status: ${status}` : '';
        const methodStr = method ? ` | Method: ${method}` : '';
        const urlStr = url ? ` | URL: ${url}` : '';
        const userIdStr = userId ? ` | UserID: ${userId}` : '';
        return `${timestamp} [${level}] (${traceId}) [${service}/${route}]: ${message}${statusStr}${methodStr}${urlStr}${userIdStr}${metadataStr}`;
    })
);

// Logger Configuration
const logger = createLogger({
    level: config.logLevel,
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        verbose: 3,
        debug: 4,
        trace: 5,
    },
    format: structuredFormat,
    transports: [
        new RouteAwareFileTransport({
            baseLogDir: config.baseLogDir,
        }),
        new winston.transports.Console({
            format: consoleFormat,
            handleExceptions: true,
            level: 'trace',
        }),
        new RouteAwareDatabaseTransport({
            batchSize: config.batchSize,
            batchInterval: config.batchInterval,
        }),
    ],
    exceptionHandlers: [
        new RouteAwareFileTransport({
            baseLogDir: config.baseLogDir,
        }),
        new winston.transports.Console({ format: consoleFormat }),
    ],
    rejectionHandlers: [
        new RouteAwareFileTransport({
            baseLogDir: config.baseLogDir,
        }),
        new winston.transports.Console({ format: consoleFormat }),
    ],
});

logger.setMaxListeners(20);

// Enhanced Logging Methods
['error', 'warn', 'info', 'verbose', 'debug', 'trace'].forEach((level) => {
    logger[level] = (message, meta = {}) => {
        logCounter.inc({ level, route: meta.route || 'general', service: meta.service || 'default' });
        logger.log(level, message, {
            ...meta,
            traceId: meta.traceId || nanoid(),
            route: meta.route || 'general',
            service: meta.service || 'default',
            status: meta.status || null,
            method: meta.method,
            url: meta.url,
            userId: meta.userId,
            sensitiveFields: meta.sensitiveFields || [],
        });
    };
});

// Sensitive Data Logging (Deprecated - Now handled in transports)
logger.sensitive = (message, meta = {}) => {
    console.warn('logger.sensitive is deprecated. Use sensitiveFields in metadata instead.');
    logger.info(message, {
        ...meta,
        sensitiveFields: meta.sensitiveFields || [],
        route: meta.route || 'general',
        status: meta.status || null,
    });
};

// Request Tracing Middleware
logger.addRequestTracing = (req, res, next) => {
    const traceId = nanoid();
    req.traceId = traceId;
    next();
};

// Metrics Endpoint
logger.getMetrics = async () => {
    return await register.metrics();
};

// Health Check
logger.health = () => {
    return {
        status: 'healthy',
        config,
        transports: logger.transports.map((t) => t.name),
    };
};

module.exports = logger;