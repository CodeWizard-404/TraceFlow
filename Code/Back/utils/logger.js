const winston = require('winston');

// Custom transport for database logging
class DatabaseTransport extends winston.Transport {
    constructor(options) {
        super(options);
        this.name = 'database';
    }

    log(info, callback) {
        setImmediate(() => {
            this.emit('logged', info);
        });

        // Lazy-load the Log model to avoid circular dependency
        const { Log } = require('../models');

        // Write to database
        Log.create({
            level: info.level,
            message: info.message,
            ip: info.ip,
            timestamp: info.timestamp || new Date(),
        }).catch((err) => {
            console.error('Failed to log to database:', err.message);
        });

        callback();
    }
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/auth.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({
                    all: true,
                    colors: {
                        error: 'red',
                        warn: 'yellow',
                        info: 'cyan',
                        debug: 'magenta',
                    },
                }),
                winston.format.printf(({ level, message, timestamp }) => {
                    return `${timestamp} [${level}]: ${message}`;
                })
            ),
        }),
        new DatabaseTransport(), // Custom transport for database
    ],
});

module.exports = logger;