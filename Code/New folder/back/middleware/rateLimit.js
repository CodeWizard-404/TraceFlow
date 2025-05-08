const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
require('dotenv').config();

const noOpLimiter = (req, res, next) => next();

if (process.env.NODE_ENV === 'production') {
    // rateLimiter.js (updated sensitiveLimiter only)
    const sensitiveLimiter = rateLimit({
        windowMs: parseInt(process.env.SENSITIVE_LIMITER_WINDOW_MS) || 10 * 60 * 1000, // 10 minutes
        max: parseInt(process.env.SENSITIVE_LIMITER_MAX) || 15,
        message: {
            error: 'Too many attempts. Please wait 10 minutes and try again.',
            waitTime: 600, // 10 minutes in seconds
        },
        handler: (req, res) => {
            logger.warn(`Sensitive rate limit hit: ${req.ip}`);
            res.status(429).json({
                error: 'Too many attempts. Please wait 10 minutes and try again.',
                waitTime: 600,
            });
        },
    });

    const otpLimiter = rateLimit({
        windowMs: parseInt(process.env.OTP_LIMITER_WINDOW_MS) || 10 * 60 * 1000, // 10 minutes
        max: parseInt(process.env.OTP_LIMITER_MAX) || 5,
        message: {
            error: 'Too many OTP requests. Please wait 10 minutes and try again.',
        },
        handler: (req, res) => {
            logger.warn(`OTP rate limit hit: ${req.ip}`);
            res.status(429).json({
                error: 'Too many OTP requests. Please wait 10 minutes and try again.',
            });
        },
    });

    const refreshLimiter = rateLimit({
        windowMs: parseInt(process.env.REFRESH_LIMITER_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
        max: parseInt(process.env.REFRESH_LIMITER_MAX) || 10,
        message: {
            error: 'Too many refresh attempts. Please wait 1 hour and try again.',
        },
        handler: (req, res) => {
            logger.warn(`Refresh rate limit hit: ${req.ip}`);
            res.status(429).json({
                error: 'Too many refresh attempts. Please wait 1 hour and try again.',
            });
        },
    });

    module.exports = { sensitiveLimiter, otpLimiter, refreshLimiter };
} else {
    module.exports = {
        sensitiveLimiter: noOpLimiter,
        otpLimiter: noOpLimiter,
        refreshLimiter: noOpLimiter,
    };
}