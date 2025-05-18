const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const pluralize = require('pluralize');
require('dotenv').config();

// Route mappings (unchanged)
const routeMappings = [
    { path: '/api/auth', file: '../routes/authRoutes.js', tag: 'Auth', controller: '../controllers/authController.js', service: '../services/authService.js', model: 'User' },
    { path: '/api/users', file: '../routes/userRoutes.js', tag: 'Users', controller: '../controllers/userController.js', service: '../services/userService.js', model: 'User' },
    { path: '/api/roles', file: '../routes/roleRoutes.js', tag: 'Roles', controller: '../controllers/roleController.js', service: '../services/roleService.js', model: 'Role' },
    { path: '/api/permissions', file: '../routes/permissionRoutes.js', tag: 'Permissions', controller: '../controllers/permissionController.js', service: '../services/permissionService.js', model: 'Permission' },
    { path: '/api/visits', file: '../routes/visitRoutes.js', tag: 'Visits', controller: '../controllers/visitController.js', service: '../services/visitService.js', model: 'Visit' },
    { path: '/api/checklists', file: '../routes/checklistRoutes.js', tag: 'Checklists', controller: '../controllers/checklistController.js', service: '../services/checklistService.js', model: 'Checklist' },
    { path: '/api/reasons', file: '../routes/reasonRoutes.js', tag: 'Reasons', controller: '../controllers/reasonController.js', service: '../services/reasonService.js', model: 'Reason' },
    { path: '/api/timesheets', file: '../routes/timesheetRoutes.js', tag: 'Timesheets', controller: '../controllers/timesheetController.js', service: '../services/timesheetService.js', model: 'Timesheet' },
    { path: '/api/agents', file: '../routes/agentRoutes.js', tag: 'Agents', controller: '../controllers/agentController.js', service: '../services/agentService.js', model: 'Agent' },
    { path: '/api/receipt-books', file: '../routes/receiptBookRoutes.js', tag: 'ReceiptBooks', controller: '../controllers/receiptBookController.js', service: '../services/receiptBookService.js', model: 'ReceiptBook' },
    { path: '/api/receipt-stubs', file: '../routes/receiptStubRoutes.js', tag: 'ReceiptStubs', controller: '../controllers/receiptStubController.js', service: '../services/receiptStubService.js', model: 'ReceiptStub' },
    { path: '/api/notifications', file: '../routes/notificationRoutes.js', tag: 'Notifications', controller: '../controllers/notificationController.js', service: '../services/notificationService.js', model: 'Notification' },
    { path: '/api/locations', file: '../routes/locationRoutes.js', tag: 'Locations', controller: '../controllers/locationController.js', service: '../services/locationsService.js', model: null },
];

// Load Sequelize models (unchanged)
const models = require('../models');

// Map Sequelize types to OpenAPI (unchanged)
function mapSequelizeTypeToOpenApi(type, field) {
    if (type.includes('STRING') || type === 'TEXT') return { type: 'string', ...(field.format ? { format: field.format } : {}) };
    if (type.includes('INTEGER') || type === 'BIGINT') return { type: 'integer' };
    if (type === 'BOOLEAN') return { type: 'boolean' };
    if (type.includes('DATE')) return { type: 'string', format: 'date-time' };
    if (type === 'BLOB') return { type: 'string', format: 'binary' };
    return { type: 'string' };
}

// Generate model schemas (unchanged)
const modelSchemas = {};
Object.keys(models).forEach((modelName) => {
    const model = models[modelName];
    if (model && model.rawAttributes) {
        const properties = Object.keys(model.rawAttributes).reduce((acc, fieldName) => {
            const field = model.rawAttributes[fieldName];
            acc[fieldName] = mapSequelizeTypeToOpenApi(field.type.toString(), field);
            return acc;
        }, {});
        modelSchemas[modelName] = { type: 'object', properties, required: Object.keys(properties).filter(k => model.rawAttributes[k].allowNull === false) };
    }
});

// Hard-coded schemas (unchanged)
modelSchemas.UserResponse = {
    type: 'object',
    properties: {
        userID: { type: 'string' },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string', nullable: true },
        firstName: { type: 'string', nullable: true },
        lastName: { type: 'string', nullable: true },
        PFP: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
    },
    required: ['userID', 'email']
};

modelSchemas.RoleResponse = {
    type: 'object',
    properties: {
        roleID: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string', nullable: true },
        Permissions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Permission' }
        }
    },
    required: ['roleID', 'name']
};

modelSchemas.AuthLoginResponse = {
    type: 'object',
    properties: {
        user: { $ref: '#/components/schemas/UserResponse' },
        tempToken: { type: 'string', nullable: true },
        refreshToken: { type: 'string', nullable: true },
        requires2FA: { type: 'boolean' }
    },
    required: ['user', 'requires2FA']
};

modelSchemas.TwoFAResponse = {
    type: 'object',
    properties: {
        user: { $ref: '#/components/schemas/UserResponse' },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' }
    },
    required: ['user', 'accessToken', 'refreshToken']
};

modelSchemas.RefreshTokenResponse = {
    type: 'object',
    properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' }
    },
    required: ['accessToken', 'refreshToken']
};

modelSchemas.PasswordResetInitResponse = {
    type: 'object',
    properties: {
        message: { type: 'string' }
    },
    required: ['message']
};

modelSchemas.RegionResponse = {
    type: 'object',
    properties: {
        regionID: { type: 'string' },
        name: { type: 'string' }
    },
    required: ['regionID', 'name']
};

modelSchemas.GovernorateResponse = {
    type: 'object',
    properties: {
        governorateID: { type: 'string' },
        name: { type: 'string' },
        regionID: { type: 'string' }
    },
    required: ['governorateID', 'name', 'regionID']
};

modelSchemas.DelegationResponse = {
    type: 'object',
    properties: {
        delegationID: { type: 'string' },
        name: { type: 'string' },
        governorateID: { type: 'string' }
    },
    required: ['delegationID', 'name', 'governorateID']
};

// Parse middleware (updated)
function parseMiddleware(routeLayer, file, routePath) {
    const middleware = [];
    const permissions = [];
    const rateLimiters = [];

    const handleInfo = {
        hasHandle: !!routeLayer.handle,
        handleType: routeLayer.handle ? typeof routeLayer.handle : 'undefined',
        handleName: routeLayer.handle && routeLayer.handle.name ? routeLayer.handle.name : 'unnamed'
    };
    console.log(`Processing middleware for ${file} - ${routePath}:`, handleInfo);

    if (!routeLayer.handle || typeof routeLayer.handle !== 'function') {
        console.log(`Skipping middleware for ${file} - ${routePath}: Invalid handle`);
        return { middleware, permissions, rateLimiters };
    }

    const handlerName = routeLayer.handle.name || '';
    let handlerString = '';
    try {
        handlerString = routeLayer.handle.toString();
    } catch (err) {
        console.log(`Failed to get toString for ${handlerName} in ${file} - ${routePath}: ${err.message}`);
        return { middleware, permissions, rateLimiters };
    }

    if (!handlerName && handlerString.includes('express-validator')) {
        middleware.push('express-validator');
        return { middleware, permissions, rateLimiters };
    }

    try {
        if (handlerName.includes('authenticateCookie') || (handlerString && handlerString.includes('authenticateCookie'))) {
            middleware.push('authenticateCookie');
        }
        if (handlerName.toLowerCase().includes('limiter') || (handlerString && handlerString.toLowerCase().includes('limiter'))) {
            rateLimiters.push(handlerName || 'unnamedLimiter');
        }
        if (handlerName.includes('bound single') || (handlerString && handlerString.includes('uploadPFP'))) {
            middleware.push('uploadPFP');
        }
    } catch (err) {
        console.log(`Error checking middleware for ${handlerName} in ${file} - ${routePath}: ${err.message}`);
        return { middleware, permissions, rateLimiters };
    }

    try {
        const permissionMatch = handlerString.match(/requirePermission\(['"]([^'"]+)['"]\)/);
        if (permissionMatch) {
            permissions.push(permissionMatch[1]);
        }
    } catch (err) {
        console.log(`Failed to parse requirePermission for ${handlerName} in ${file} - ${routePath}: ${err.message}`);
    }

    return { middleware, permissions, rateLimiters };
}

// Parse service (unchanged)
function parseService(servicePath) {
    if (!fs.existsSync(path.join(__dirname, servicePath))) {
        console.log(`Service file not found: ${servicePath}`);
        return { queries: {}, validation: { properties: {}, required: [] }, errors: [] };
    }

    const serviceCode = fs.readFileSync(path.join(__dirname, servicePath), 'utf-8');
    const ast = acorn.parse(serviceCode, { sourceType: 'module', ecmaVersion: 2020 });
    const queries = {};
    const validation = { properties: {}, required: [] };
    const errors = [];

    walk.simple(ast, {
        MethodDefinition(node) {
            const methodName = node.key.name;
            let query = null;
            walk.simple(node.value.body, {
                AwaitExpression(n) {
                    if (n.argument?.type === 'CallExpression' && n.argument.callee?.type === 'MemberExpression') {
                        const method = n.argument.callee.property.name;
                        if (['findAll', 'findOne', 'create', 'update', 'findByPk'].includes(method)) {
                            const modelName = n.argument.callee.object?.name || 'Unknown';
                            let attributes = [];
                            let includes = [];
                            if (n.argument.arguments?.length && n.argument.arguments[0]?.type === 'ObjectExpression') {
                                n.argument.arguments[0].properties.forEach(prop => {
                                    if (prop.key.name === 'attributes' && prop.value.type === 'ArrayExpression') {
                                        attributes = prop.value.elements.map(el => el.value);
                                    } else if (prop.key.name === 'include' && prop.value.type === 'ArrayExpression') {
                                        includes = prop.value.elements.map(el => {
                                            if (el.type === 'ObjectExpression') {
                                                const modelProp = el.properties.find(p => p.key.name === 'model');
                                                const asProp = el.properties.find(p => p.key.name === 'as');
                                                return { model: modelProp?.value.name, as: asProp?.value.value || modelProp?.value.name };
                                            }
                                            return null;
                                        }).filter(Boolean);
                                    }
                                });
                            }
                            query = { type: method, model: modelName, attributes, includes };
                        }
                    }
                },
                IfStatement(n) {
                    if (n.test?.type === 'UnaryExpression' && n.test.operator === '!') {
                        const field = n.test.argument?.name;
                        if (field) {
                            validation.required.push(field);
                            validation.properties[field] = { type: 'string' };
                        }
                    } else if (n.test?.type === 'BinaryExpression' && n.test.left?.type === 'MemberExpression') {
                        const field = n.test.left.property?.name;
                        if (field) {
                            validation.properties[field] = { type: 'string' };
                            if (n.consequent?.body?.some(b => b.type === 'ThrowStatement')) {
                                validation.required.push(field);
                            }
                        }
                    }
                },
                ThrowStatement(n) {
                    if (n.argument?.type === 'NewExpression' && n.argument.callee.name === 'Error' && n.argument.arguments?.[0]?.value) {
                        errors.push({ status: 400, message: n.argument.arguments[0].value });
                    }
                }
            });
            queries[methodName] = query;
        }
    });

    return { queries, validation, errors };
}

// Parse controller (unchanged)
function parseController(controllerPath) {
    if (!fs.existsSync(path.join(__dirname, controllerPath))) {
        console.log(`Controller file not found: ${controllerPath}`);
        return { mappings: {}, responses: {}, errors: [], validation: { properties: {}, required: [] }, queries: {} };
    }

    const controllerCode = fs.readFileSync(path.join(__dirname, controllerPath), 'utf-8');
    const ast = acorn.parse(controllerCode, { sourceType: 'module', ecmaVersion: 2020 });
    const mappings = {};
    const responses = {};
    const errors = [];
    const validation = { properties: {}, required: [] };
    const queries = {};

    walk.simple(ast, {
        MethodDefinition(node) {
            const methodName = node.key.name;
            let serviceMethod = null;
            let responseSchema = null;
            walk.simple(node.value.body, {
                CallExpression(n) {
                    if (n.callee?.type === 'MemberExpression' && n.callee.object?.name?.endsWith('Service')) {
                        serviceMethod = n.callee.property.name;
                    }
                    if (n.callee?.type === 'MemberExpression' && n.callee.object?.name === 'res' && n.callee.property?.name === 'json') {
                        responseSchema = inferSchemaFromExpression(n.arguments?.[0]);
                    }
                    if (n.callee?.type === 'MemberExpression' && n.callee.object?.type === 'CallExpression' && n.callee.object.callee?.name === 'status' && n.callee.property?.name === 'json') {
                        const statusCode = n.callee.object.arguments?.[0]?.value;
                        const errorMsg = n.arguments?.[0]?.properties?.find(p => p.key.name === 'error')?.value?.value;
                        if (statusCode && errorMsg) {
                            errors.push({ status: parseInt(statusCode), message: errorMsg });
                        }
                    }
                    if (n.callee?.name === 'validationResult') {
                        validation.properties = {
                            ...validation.properties,
                            ...inferValidationFromValidator(n)
                        };
                    }
                },
                IfStatement(n) {
                    if (n.test?.type === 'UnaryExpression' && n.test.operator === '!') {
                        const field = n.test.argument?.name;
                        if (field && n.test.argument?.type === 'MemberExpression' && n.test.argument.object?.name === 'req' && n.test.argument.property?.name === 'body') {
                            validation.required.push(field);
                            validation.properties[field] = { type: 'string' };
                        }
                    } else if (n.test?.type === 'BinaryExpression' && n.test.left?.type === 'MemberExpression' && n.test.left.object?.name === 'req' && n.test.left.property?.name === 'body') {
                        const field = n.test.left.property.name;
                        validation.properties[field] = { type: 'string' };
                        if (n.consequent?.body?.some(b => b.expression?.callee?.object?.callee?.name === 'status')) {
                            validation.required.push(field);
                        }
                    }
                },
                MemberExpression(n) {
                    if (n.object?.name === 'req' && n.property?.name === 'query') {
                        const field = n.property.name;
                        queries[field] = { type: 'string' };
                    }
                }
            });
            mappings[methodName] = serviceMethod;
            if (responseSchema) responses[methodName] = responseSchema;
        }
    });

    return { mappings, responses, errors, validation, queries };
}

// Infer validation from express-validator (unchanged)
function inferValidationFromValidator(node) {
    const properties = {};
    return properties;
}

// Infer schema from expression (unchanged)
function inferSchemaFromExpression(expr) {
    if (!expr) return { type: 'object', properties: {} };
    if (expr.type === 'ObjectExpression') {
        const properties = {};
        expr.properties.forEach(prop => {
            if (prop.key?.name) {
                properties[prop.key.name] = inferSchemaFromExpression(prop.value);
            }
        });
        return { type: 'object', properties };
    }
    if (expr.type === 'ArrayExpression') {
        return { type: 'array', items: expr.elements[0] ? inferSchemaFromExpression(expr.elements[0]) : { type: 'object' } };
    }
    if (expr.type === 'Literal') {
        return { type: typeof expr.value };
    }
    if (expr.type === 'Identifier' && modelSchemas[expr.name]) {
        return { $ref: `#/components/schemas/${expr.name}` };
    }
    return { type: 'string' };
}

// Build response schema (unchanged)
function buildResponseSchema(query, modelSchemas, tag, routePath, method, controllerMethod) {
    if (tag === 'Auth') {
        if (method === 'post' && routePath === '/login') {
            return { $ref: '#/components/schemas/AuthLoginResponse' };
        }
        if (method === 'post' && routePath === '/verify-2fa') {
            return { $ref: '#/components/schemas/TwoFAResponse' };
        }
        if (method === 'post' && routePath === '/refresh') {
            return { $ref: '#/components/schemas/RefreshTokenResponse' };
        }
        if (method === 'post' && routePath === '/resend-2fa') {
            return { type: 'object', properties: { message: { type: 'string' } } };
        }
        if (method === 'post' && routePath === '/reset-password/init') {
            return { $ref: '#/components/schemas/PasswordResetInitResponse' };
        }
        if (method === 'post' && routePath === '/reset-password/verify') {
            return { type: 'object', properties: { message: { type: 'string' } } };
        }
        if (method === 'post' && routePath === '/reset-password') {
            return { type: 'object', properties: { message: { type: 'string' } } };
        }
        if (method === 'post' && routePath === '/logout') {
            return { type: 'object', properties: { message: { type: 'string' } } };
        }
        if (method === 'get' && routePath === '/google-callback') {
            return { $ref: '#/components/schemas/AuthLoginResponse' };
        }
    }
    if (tag === 'Users') {
        if (method === 'get' && routePath === '/:userID/supervisors') {
            return { type: 'array', items: { $ref: '#/components/schemas/UserResponse' } };
        }
        if (method === 'get' && routePath === '/:userID/regions') {
            return { type: 'array', items: { $ref: '#/components/schemas/RegionResponse' } };
        }
        if (method === 'get' && routePath === '/profile') {
            return { $ref: '#/components/schemas/UserResponse' };
        }
        if (method === 'get' && routePath === '/') {
            return { type: 'array', items: { $ref: '#/components/schemas/UserResponse' } };
        }
        if (method === 'get' && routePath === '/:userID') {
            return { $ref: '#/components/schemas/UserResponse' };
        }
        if (method === 'post' && routePath === '/') {
            return { $ref: '#/components/schemas/UserResponse' };
        }
        if (method === 'put' && routePath === '/:userID') {
            return { $ref: '#/components/schemas/UserResponse' };
        }
        if (method === 'delete' && routePath === '/:userID') {
            return { type: 'object', properties: { message: { type: 'string' } } };
        }
    }
    if (tag === 'Roles') {
        if (method === 'get' && routePath === '/') {
            return { type: 'array', items: { $ref: '#/components/schemas/RoleResponse' } };
        }
        if (method === 'get' && routePath === '/:roleID') {
            return { $ref: '#/components/schemas/RoleResponse' };
        }
        if (method === 'post' && routePath === '/') {
            return { $ref: '#/components/schemas/RoleResponse' };
        }
        if (method === 'put' && routePath === '/:roleID') {
            return { $ref: '#/components/schemas/RoleResponse' };
        }
        if (method === 'delete' && routePath === '/:roleID') {
            return { type: 'object', properties: { message: { type: 'string' } } };
        }
    }
    if (!query) {
        return modelSchemas[tag] ? { type: 'object', properties: modelSchemas[tag].properties } : { type: 'object', properties: {} };
    }

    const { model, attributes, includes, type } = query;
    const modelSchema = modelSchemas[model] || { properties: {} };
    let properties = {};

    if (attributes.length) {
        attributes.forEach(attr => {
            if (modelSchema.properties[attr]) properties[attr] = modelSchema.properties[attr];
        });
    } else {
        properties = { ...modelSchema.properties };
    }

    includes.forEach(inc => {
        const incModel = inc.model;
        const incAs = inc.as || pluralize(incModel);
        properties[incAs] = {
            type: 'array',
            items: modelSchemas[incModel] ? { $ref: `#/components/schemas/${incModel}` } : { type: 'object' },
        };
    });

    const schema = { type: 'object', properties };
    return type === 'findAll' ? { type: 'array', items: schema } : schema;
}

// Generate operation ID (unchanged)
function generateOperationId(method, routePath, tag) {
    const pathParts = routePath.split('/').filter(p => p && !p.startsWith(':'));
    const paramParts = routePath.split('/').filter(p => p.startsWith(':')).map(p => p.slice(1));
    let operation = `${method}${tag}`;
    if (pathParts.length) {
        operation += pathParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    }
    if (paramParts.length) {
        operation += 'By' + paramParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('And');
    }
    return operation.charAt(0).toLowerCase() + operation.slice(1);
}

// Generate description (unchanged)
function generateDescription(method, routePath, tag) {
    const methodDescriptions = {
        get: 'Retrieves',
        post: 'Creates',
        put: 'Updates',
        delete: 'Deletes'
    };
    const resource = tag.toLowerCase();
    const pathParts = routePath.split('/').filter(p => p && !p.startsWith(':'));
    const paramParts = routePath.split('/').filter(p => p.startsWith(':')).map(p => p.slice(1));
    let description = `${methodDescriptions[method] || method.toUpperCase()} `;
    if (paramParts.length) {
        description += `${resource} related to ${paramParts.join(' and ')}`;
    } else if (pathParts.length) {
        description += `${resource} for ${pathParts.join(' ')}`;
    } else {
        description += `${resource}`;
    }
    return description;
}

// Extract parameters (unchanged)
function extractParameters(routePath) {
    const params = [];
    const matches = routePath.match(/:([^\/]+)/g);
    if (matches) {
        matches.forEach(match => {
            params.push({ name: match.slice(1), in: 'path', required: true, schema: { type: 'string' } });
        });
    }
    return params;
}

// OpenAPI spec (unchanged)
const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'TraceFlow API',
        description: 'Comprehensive API for the TraceFlow backend, managing users, roles, permissions, and more. Authentication uses Keycloak with an `accessToken` cookie, validated via introspection. Authorization requires specific permissions checked via Keycloak UMA tickets. Rate limiting applies to sensitive endpoints.',
        version: '1.0.0'
    },
    servers: [
        { url: process.env.NODE_ENV === 'production' ? process.env.PROD_URL : `${process.env.DEV_URL}:${process.env.PORT}` }
    ],
    components: {
        securitySchemes: {
            cookieAuth: {
                type: 'apiKey',
                in: 'cookie',
                name: 'accessToken',
                description: 'Requires `accessToken` cookie from Keycloak login. Validated via Keycloak introspection.'
            }
        },
        schemas: {
            ErrorResponse: { type: 'object', properties: { error: { type: 'string' } } },
            ValidationErrorResponse: {
                type: 'object',
                properties: { error: { type: 'string' }, errors: { type: 'array', items: { type: 'string' } } }
            },
            ...modelSchemas
        }
    },
    paths: {}
};

// Process routes (updated)
routeMappings.forEach(({ path: basePath, file, tag, controller, service, model }) => {
    try {
        const routeModule = require(file);
        const { mappings, responses, errors: controllerErrors, validation, queries } = parseController(controller);
        const { queries: serviceQueries, validation: serviceValidation, errors: serviceErrors } = parseService(service);

        if (!routeModule || !routeModule.stack) {
            console.log(`Invalid route module for ${file}: No stack found`);
            return;
        }

        const routes = routeModule.stack || [];
        console.log(`Processing ${file} with ${routes.length} routes`);

        routes.forEach((layer, index) => {
            if (!layer.route || !layer.route.stack) {
                console.log(`Skipping invalid route layer in ${file} at index ${index}: No route or stack`);
                return;
            }

            const routePath = layer.route.path;
            const fullPath = `${basePath}${routePath === '/' ? '' : routePath}`;
            const methods = layer.route.methods;

            console.log(`Route stack for ${fullPath}:`, layer.route.stack.map(s => ({
                handleName: s.handle ? s.handle.name : 'unnamed',
                handleType: s.handle ? typeof s.handle : 'undefined'
            })));

            let handler = null;
            for (let i = layer.route.stack.length - 1; i >= 0; i--) {
                if (layer.route.stack[i].handle && typeof layer.route.stack[i].handle === 'function') {
                    handler = layer.route.stack[i].handle;
                    break;
                }
            }

            if (!handler) {
                console.log(`No valid handler found for ${fullPath}`);
                return;
            }

            const controllerMethod = handler.name || 'anonymous';
            const serviceMethod = mappings[controllerMethod] || controllerMethod;
            const query = serviceQueries[serviceMethod];
            const middlewareStack = layer.route.stack.map((stackLayer) => parseMiddleware(stackLayer, file, fullPath))
                .filter(m => m.middleware.length || m.permissions.length || m.rateLimiters.length);

            const allMiddleware = [...new Set(middlewareStack.flatMap(m => m.middleware))];
            const allPermissions = [...new Set(middlewareStack.flatMap(m => m.permissions))];
            const allRateLimiters = [...new Set(middlewareStack.flatMap(m => m.rateLimiters))];

            openApiSpec.paths[fullPath] = openApiSpec.paths[fullPath] || {};
            Object.keys(methods).forEach(method => {
                const responseSchema = responses[controllerMethod] || buildResponseSchema(query, modelSchemas, tag, routePath, method, controllerMethod);
                const operation = {
                    tags: [tag],
                    summary: generateDescription(method, routePath, tag),
                    description: generateDetailedDescription(method, fullPath, tag, allPermissions, allMiddleware, allRateLimiters),
                    operationId: generateOperationId(method, routePath, tag),
                    parameters: [
                        ...extractParameters(routePath),
                        ...Object.keys(queries).map(key => ({
                            name: key,
                            in: 'query',
                            required: false,
                            schema: queries[key]
                        }))
                    ],
                    responses: {
                        [method === 'post' ? 201 : 200]: {
                            description: method === 'post' ? 'Created' : 'OK',
                            content: { 'application/json': { schema: responseSchema } }
                        }
                    },
                    security: basePath === '/api/auth' ? [] : [{ cookieAuth: [] }],
                    'x-middleware': allMiddleware,
                    'x-permissions': allPermissions,
                    'x-rateLimiters': allRateLimiters
                };

                if (['post', 'put'].includes(method)) {
                    const combinedValidation = {
                        properties: { ...validation.properties, ...serviceValidation.properties },
                        required: [...new Set([...validation.required, ...serviceValidation.required])]
                    };
                    if (allMiddleware.includes('uploadPFP')) {
                        operation.requestBody = {
                            content: {
                                'multipart/form-data': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            PFP: { type: 'string', format: 'binary' },
                                            ...combinedValidation.properties
                                        },
                                        required: ['PFP', ...combinedValidation.required]
                                    }
                                }
                            }
                        };
                    } else if (Object.keys(combinedValidation.properties).length) {
                        operation.requestBody = {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: combinedValidation.properties,
                                        required: combinedValidation.required
                                    }
                                }
                            }
                        };
                    }
                }

                [...controllerErrors, ...serviceErrors].forEach(err => {
                    operation.responses[err.status] = {
                        description: err.message,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
                    };
                });

                if (allRateLimiters.length) {
                    operation.responses[429] = {
                        description: 'Too many requests. Please try again later.',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
                    };
                }

                if (!operation.responses[400]) {
                    operation.responses[400] = {
                        description: 'Bad Request',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } }
                    };
                }
                if (!operation.responses[401]) {
                    operation.responses[401] = {
                        description: 'Unauthorized',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
                    };
                }
                if (!operation.responses[403]) {
                    operation.responses[403] = {
                        description: 'Forbidden',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
                    };
                }
                if (!operation.responses[404]) {
                    operation.responses[404] = {
                        description: 'Not Found',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
                    };
                }
                if (!operation.responses[500]) {
                    operation.responses[500] = {
                        description: 'Internal Server Error',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
                    };
                }

                openApiSpec.paths[fullPath][method] = operation;
            });
        });
    } catch (err) {
        console.error(`Error processing route ${file}: ${err.message}`);
    }
});

// Generate detailed description (updated)
function generateDetailedDescription(method, fullPath, tag, permissions, middleware, rateLimiters) {
    let description = `### ${method.toUpperCase()} ${fullPath}\n\n`;
    description += `**Purpose**: ${generateDescription(method, fullPath.replace('/api/' + tag.toLowerCase(), ''), tag)}.\n\n`;

    if (tag === 'Auth') {
        description += `**Context**: Handles authentication flows, including login, 2FA, token refresh, and password reset. Uses Keycloak for token validation. No permissions required.\n\n`;
    } else if (tag === 'Users') {
        description += `**Context**: Manages user profiles, hierarchies (supervisors, regional managers, directors), and geographic assignments (regions, governorates, delegations). Requires specific permissions.\n\n`;
    } else if (tag === 'Roles') {
        description += `**Context**: Manages roles and their assignments to users, including permissions. Requires specific permissions.\n\n`;
    }

    if (middleware.includes('authenticateCookie')) {
        description += `**Authentication**: Requires a valid \`accessToken\` cookie, validated via Keycloak introspection.\n`;
    }
    if (permissions.length) {
        description += `**Permissions**: Requires ${permissions.map(p => `\`${p}\``).join(', ')}. Super Admin role bypasses permission checks.\n`;
    }
    if (rateLimiters.length) {
        description += `**Rate Limiting**:\n`;
        rateLimiters.forEach(limiter => {
            description += `- \`${limiter}\`: Custom rate limiting applied.\n`;
        });
    }
    if (middleware.includes('uploadPFP')) {
        description += `**File Upload**: Accepts a profile picture (\`PFP\`) via \`multipart/form-data\`.\n`;
    }

    description += `\n**Notes**:\n- Responses include detailed error messages for debugging.\n- Logs are generated for all requests using the custom logger.\n`;

    return description;
}

// Write spec (unchanged)
fs.writeFileSync(path.join(__dirname, '../openapi.json'), JSON.stringify(openApiSpec, null, 2));
console.log('OpenAPI spec generated at: openapi.json');