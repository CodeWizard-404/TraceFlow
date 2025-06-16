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
 * Checks if a value appears to be encrypted or binary data (e.g., base64, Buffer, or QR code-like objects).
 * @param {any} value - The value to check.
 * @returns {boolean} - True if the value is likely encrypted or binary.
 */
const isEncryptedData = (value) => {
    if (typeof value !== 'string' && typeof value !== 'object') return false;

    if (typeof value === 'string') {
        const base64Regex = /^[A-Za-z0-9+/=]+$/;
        return (
            value.includes('bytea') ||
            value.includes('\\x') ||
            /^[0-9a-fA-F]{8,}$/.test(value) ||
            (base64Regex.test(value) && value.length > 20) ||
            (value.length > 50 && !/\s/.test(value) && /[^a-zA-Z0-9\s]/.test(value))
        );
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const keys = Object.keys(value);
        return (
            (keys.length > 50 && keys.every(key => !isNaN(key)) && Object.values(value).every(val => typeof val === 'number')) ||
            (value.type === 'Buffer' && Array.isArray(value.data))
        );
    }

    return false;
};

/**
 * Sanitizes an object by replacing encrypted fields with 'encrypted' and sensitive fields with 'encrypt' for specific fields.
 * @param {Object} obj - The object to sanitize.
 * @param {string[]} sensitiveFields - Fields to mark as 'encrypted'.
 * @param {string} service - The service name (e.g., 'auth', 'role').
 * @returns {Object} - Sanitized object.
 */
const sanitizeObject = (obj, sensitiveFields = ['password'], service = 'api') => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, sensitiveFields, service));
    }

    // Hardcode: always treat accessToken, refreshToken, tempToken, and password appropriately
    const authSensitiveFields = [...new Set([...sensitiveFields, 'accessToken', 'refreshToken', 'password'])];

    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => {
            // Hardcode: explicitly check for accessToken, refreshToken, password, and tempToken (case-insensitive)
            if (['accesstoken', 'refreshtoken', 'password'].includes(key.toLowerCase())) {
                return [key, 'encrypted'];
            }
            if (key.toLowerCase() === 'temptoken') {
                return [key, 'encrypt'];
            }
            // Hardcode: if key is qrCode (any case), force to 'encrypted'
            if (key.toLowerCase() === 'qrcode') {
                return [key, 'encrypted'];
            }
            // Fallback for other encrypted data
            if (isEncryptedData(value)) {
                return [key, 'encrypted'];
            }
            if (typeof value === 'object' && value !== null) {
                return [key, sanitizeObject(value, authSensitiveFields, service)];
            }
            return [key, value];
        })
    );
};

/**
 * Processes a response, summarizing large arrays/objects and limiting recursion depth.
 * @param {Object|Array} res - The response data.
 * @param {number} depth - Current recursion depth.
 * @param {string} service - The service name (e.g., 'auth', 'role').
 * @returns {Object|Array|string} - Processed response body.
 */
const processResponse = (res, depth = 0, service = 'api') => {
    if (depth > 10) {
        return 'truncated: max depth exceeded';
    }

    if (!res || typeof res !== 'object') return res;

    if (Array.isArray(res)) {
        if (res.length > 1) {
            return {
                data: sanitizeObject(res[0], ['password'], service),
                additionalCount: `... ${res.length - 1} more objects`
            };
        }
        if (res.length === 1) {
            return [sanitizeObject(res[0], ['password'], service)];
        }
        return [];
    }

    return Object.fromEntries(
        Object.entries(res).map(([key, value]) => {
            // Hardcode: for roles object (case-insensitive), return only the count of permissions
            if (key.toLowerCase() === 'roles' && Array.isArray(value)) {
                return [key, value.map(role => ({
                    ...sanitizeObject(role, ['password'], service),
                    permissions: role.permissions ? `${role.permissions.length} permissions` : '0 permissions'
                }))];
            }
            // For role controller, summarize permissions array (case-insensitive)
            if (service === 'role' && key.toLowerCase() === 'permissions' && Array.isArray(value)) {
                if (value.length > 0) {
                    return [key, {
                        firstPermission: sanitizeObject(value[0], ['password'], service),
                        additionalCount: `${value.length - 1} more permissions`
                    }];
                }
                return [key, []];
            }
            if (Array.isArray(value)) {
                if (value.length > 1) {
                    return [key, {
                        data: sanitizeObject(value[0], ['password'], service),
                        additionalCount: `... ${value.length - 1} more objects`
                    }];
                }
                if (value.length === 1) {
                    return [key, [sanitizeObject(value[0], ['password'], service)]];
                }
                return [key, []];
            }
            if (typeof value === 'object' && value !== null) {
                return [key, processResponse(value, depth + 1, service)];
            }
            return [key, value];
        })
    );
};

/**
 * Sanitizes a request object by removing sensitive fields and headers.
 * @param {Object} req - The Express request object.
 * @param {Object} [options] - Configuration options for sanitization.
 * @param {string[]} [options.sensitiveFields=['password']] - Fields to mark as 'encrypted'.
 * @param {string} [options.service='api'] - Service name for context-specific sanitization.
 * @returns {Object} - Sanitized request data with full body, query, and params.
 */
const sanitizeRequest = (req, {
    sensitiveFields = ['password'],
    service = 'api'
} = {}) => {
    return {
        body: req.body ? sanitizeObject(req.body, sensitiveFields, service) : {},
        query: req.query ? sanitizeObject(req.query, sensitiveFields, service) : {},
        params: req.params ? sanitizeObject(req.params, sensitiveFields, service) : {}
    };
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

    // Final sanitization to catch any missed sensitive fields
    const sanitizedResponse = res ? JSON.parse(JSON.stringify(res, (key, value) => {
        if (['accesstoken', 'refreshtoken', 'qrcode', 'password', 'PFP'].includes(key.toLowerCase())) {
            return 'encrypted';
        }
        if (key.toLowerCase() === 'temptoken') {
            return 'encrypt';
        }
        // Hardcode: limit response arrays to first object with count of remaining
        if (Array.isArray(value) && value.length > 1) {
            return {
                data: value[0], // Avoid recursive sanitizeObject to prevent stack overflow
                additionalCount: `... ${value.length - 1} more objects`
            };
        }
        if (Array.isArray(value) && value.length === 1) {
            return [value[0]]; // Return single item as array
        }
        return value;
    })) : res;

    const logMetadata = error
        ? { request: sanitizeRequest(req, { service }), error: error.message, ...sanitizeObject(metadata, ['password'], service) }
        : { request: sanitizeRequest(req, { service }), response: processResponse(sanitizedResponse, 0, service), ...sanitizeObject(metadata, ['password'], service) };

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