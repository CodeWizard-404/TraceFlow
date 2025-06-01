const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
require('dotenv').config();

const noOpLimiter = (req, res, next) => next();

if (process.env.NODE_ENV === 'production') {
    const sensitiveLimiter = rateLimit({
        windowMs: parseInt(process.env.SENSITIVE_LIMITER_WINDOW_MS) || 10 * 60 * 1000, // 10 minutes
        max: parseInt(process.env.SENSITIVE_LIMITER_MAX) || 15,
        message: {
            error: 'Too many attempts. Please wait 10 minutes and try again.',
            waitTime: 600, // 10 minutes in seconds
        },
        handler: (req, res) => {
            logger.warn('Sensitive rate limit hit', {
                route: 'rate-limit',
                service: 'security',
                ip: req.ip,
            });
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
            logger.warn('OTP rate limit hit', {
                route: 'rate-limit',
                service: 'security',
                ip: req.ip,
            });
            res.status(429).json({
                error: 'Too many OTP requests. Please wait 10 minutes and try again.',
            });
        },
    });

    const refreshLimiter = rateLimit({
        windowMs: parseInt(process.env.REFRESH_LIMITER_WINDOW_MS) || 10 * 60 * 1000,
        max: parseInt(process.env.REFRESH_LIMITER_MAX) || 10,
        message: {
            error: 'Too many refresh attempts. Please wait 1 hour and try again.',
        },
        handler: (req, res) => {
            logger.warn('Refresh rate limit hit', {
                route: 'rate-limit',
                service: 'security',
                ip: req.ip,
            });
            res.status(429).json({
                error: 'Too many refresh attempts. Please wait 1 hour and try again.',
            });
        },
    });

    const aiLimiter = rateLimit({
        windowMs: parseInt(process.env.AI_LIMITER_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.AI_LIMITER_MAX) || 10,
        message: {
            error: 'Too many AI requests. Please wait 15 minutes and try again.',
        },
        handler: (req, res) => {
            logger.warn('AI rate limit hit', {
                route: 'rate-limit',
                service: 'ai',
                ip: req.ip,
            });
            res.status(429).json({
                error: 'Too many AI requests. Please wait 15 minutes and try again.',
            });
        },
    });

    module.exports = { sensitiveLimiter, otpLimiter, refreshLimiter, aiLimiter };
} else {
    module.exports = {
        sensitiveLimiter: noOpLimiter,
        otpLimiter: noOpLimiter,
        refreshLimiter: noOpLimiter,
        aiLimiter: noOpLimiter,
    };
}