// middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

// Limit for sensitive endpoints (login, OTP verification)
const sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 5 requests per IP
    message: {
        error: 'Too many attempts. Please wait 15 minutes and try again.',
    },
});

// Limit for OTP resend and password reset initiation
const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 300, // 3 requests per IP
    message: {
        error: 'Too many OTP requests. Please wait 1 hour and try again.',
    },
});

// Limit for token refresh (less strict)
const refreshLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10000000, // 10 requests per IP
    message: {
        error: 'Too many refresh attempts. Please wait 1 hour and try again.',
    },
});

module.exports = { sensitiveLimiter, otpLimiter, refreshLimiter };