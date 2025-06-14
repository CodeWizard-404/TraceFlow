const logger = require('./logger');

/**
 * Stringifies an object without truncation.
 * @param {Object} obj - The object to stringify.
 * @returns {string} - The stringified object.
 */
const stringifyObject = (obj) => {
    return JSON.stringify(obj, null, 2);
};

/**
 * Sanitizes a request object by removing sensitive fields and headers.
 * @param {Object} req - The Express request object.
 * @param {Object} [options] - Configuration options for sanitization.
 * @param {string[]} [options.sensitiveFields=['password']] - Fields to remove from the body.
 * @returns {Object} - Sanitized request data with full body, query, and params.
 */
const sanitizeRequest = (req, {
    sensitiveFields = ['password']
} = {}) => {
    // Sanitize body by removing sensitive fields
    const sanitizedBody = req.body ? Object.fromEntries(
        Object.entries(req.body).filter(([key]) => !sensitiveFields.includes(key))
    ) : {};

    return {
        body: sanitizedBody,
        query: req.query,
        params: req.params
    };
};

/**
 * Processes a response, showing first object and count for arrays, or full single object.
 * @param {Object|Array} res - The response data.
 * @returns {Object|string} - Processed response body.
 */
const processResponse = (res) => {
    if (Array.isArray(res) && res.length > 1) {
        return {
            data: res[0],
            additionalCount: `... ${res.length - 1} more objects`
        };
    }
    return res;
};

/**
 * Logs a request with customizable service and route extraction.
 * @param {Object} params - Parameters for logging.
 * @param {Object} params.req - The Express request object.
 * @param {Object|Array} [params.res] - The response data.
 * @param {Error} [params.error] - The error object, if any.
 * @param {number} params.status - HTTP status code.
 * @param {string} params.message - Log message.
 * @param {string} params.level - Log level (e.g., 'info', 'error').
 * @param {Object} [params.metadata={}] - Additional metadata to include.
 * @param {string} [params.service='api'] - Service name for the log.
 * @param {string} [params.routePrefix='/api/'] - Prefix to extract route from URL.
 * @param {string} [params.defaultRoute='unknown'] - Default route if extraction fails.
 */
const logRequest = ({
    req,
    res,
    error,
    status,
    message,
    level,
    metadata = {},
    service = 'api',
    routePrefix = '/api/',
    defaultRoute = 'N/A'
}) => {
    const route = req.originalUrl.split(routePrefix)[1]?.split('/')[0] || defaultRoute;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'N/A';
    const userId = req.user?.userID || 'N/A';

    const logMetadata = error
        ? { request: sanitizeRequest(req), error: error.message, ...metadata }
        : { request: sanitizeRequest(req), response: processResponse(res), ...metadata };

    logger.log({
        level,
        message,
        fullUrl: req.originalUrl,
        route,
        ipAddress,
        service,
        status,
        method: req.method,
        userId,
        traceId: req.traceId,
        metadata: logMetadata,
    });
};

module.exports = {
    stringifyObject,
    sanitizeRequest,
    processResponse,
    logRequest
};