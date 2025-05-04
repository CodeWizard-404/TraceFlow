const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const pluralize = require('pluralize');
const { Op } = require('sequelize');
require('dotenv').config();

// Define route mappings
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

// Load Sequelize models
const models = require('../models');

// Map Sequelize types to OpenAPI
function mapSequelizeTypeToOpenApi(type, field) {
    const typeStr = type.toString().split('(')[0];
    const result = {};

    if (typeStr === 'STRING' || typeStr === 'TEXT') {
        result.type = 'string';
        if (field.validate?.isEmail) result.format = 'email';
        if (field.validate?.isUrl) result.format = 'uri';
        if (field.validate?.len) result.minLength = field.validate.len[0] || 0, result.maxLength = field.validate.len[1];
        if (field.validate?.is) result.pattern = field.validate.is.source;
    } else if (typeStr === 'INTEGER' || typeStr === 'BIGINT') {
        result.type = 'integer';
        if (field.validate?.min) result.minimum = field.validate.min;
        if (field.validate?.max) result.maximum = field.validate.max;
    } else if (typeStr === 'FLOAT' || typeStr === 'DOUBLE' || typeStr === 'DECIMAL') {
        result.type = 'number';
        result.format = 'float';
        if (field.validate?.min) result.minimum = field.validate.min;
        if (field.validate?.max) result.maximum = field.validate.max;
    } else if (typeStr === 'BOOLEAN') {
        result.type = 'boolean';
    } else if (typeStr === 'DATE' || typeStr === 'DATEONLY') {
        result.type = 'string';
        result.format = 'date-time';
    } else if (typeStr === 'BLOB') {
        result.type = 'string';
        result.format = 'binary';
    } else if (typeStr === 'ENUM') {
        result.type = 'string';
        result.enum = field.values;
    } else {
        result.type = 'string';
    }

    return result;
}

// Generate model schemas with associations
const modelSchemas = {};
const associations = {};
Object.keys(models).forEach((modelName) => {
    if (typeof models[modelName] === 'function') return; // Skip non-model exports
    const model = models[modelName];
    if (model && model.rawAttributes) {
        const properties = {};
        const required = [];

        Object.keys(model.rawAttributes).forEach((fieldName) => {
            const field = model.rawAttributes[fieldName];
            properties[fieldName] = mapSequelizeTypeToOpenApi(field.type, field);
            if (!field.allowNull && !field.defaultValue && !field.autoIncrement) {
                required.push(fieldName);
            }
        });

        modelSchemas[modelName] = {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined,
        };

        // Capture associations
        associations[modelName] = [];
        if (model.associations) {
            Object.values(model.associations).forEach((assoc) => {
                associations[modelName].push({
                    type: assoc.associationType,
                    target: assoc.target.name,
                    as: assoc.as,
                    through: assoc.through?.model?.name,
                });
            });
        }
    }
});

// Parse controller to extract detailed request/response/error info
function parseController(controllerPath) {
    const controllerCode = fs.readFileSync(path.join(__dirname, controllerPath), 'utf-8');
    const ast = acorn.parse(controllerCode, { sourceType: 'module', ecmaVersion: 2020 });
    const methods = {};

    walk.simple(ast, {
        MethodDefinition(node) {
            if (node.key.name && node.value.async) {
                const methodName = node.key.name;
                const requestBody = { properties: {}, required: [] };
                const responses = {};
                const errors = [];

                // Extract destructured req.body
                walk.simple(node.value.body, {
                    VariableDeclaration(node) {
                        node.declarations.forEach((decl) => {
                            if (
                                decl.init?.type === 'MemberExpression' &&
                                decl.init.object.name === 'req' &&
                                decl.init.property.name === 'body'
                            ) {
                                if (decl.id.type === 'ObjectPattern') {
                                    decl.id.properties.forEach((prop) => {
                                        const propName = prop.key.name;
                                        requestBody.properties[propName] = { type: 'string' }; // Default, refined later
                                        requestBody.required.push(propName);
                                    });
                                }
                            }
                        });
                    },
                    // Extract res.status().json() calls
                    CallExpression(node) {
                        if (
                            node.callee.type === 'MemberExpression' &&
                            node.callee.object.name === 'res' &&
                            node.callee.property.name === 'json'
                        ) {
                            const statusNode = findStatusNode(node);
                            const status = statusNode ? statusNode.arguments[0].value : 200;
                            const arg = node.arguments[0];
                            let schema = {};

                            if (arg.type === 'ObjectExpression') {
                                schema = { type: 'object', properties: {} };
                                arg.properties.forEach((prop) => {
                                    schema.properties[prop.key.name] = inferTypeFromValue(prop.value);
                                });
                            } else if (arg.type === 'Identifier') {
                                schema = { $ref: `#/components/schemas/${arg.name}` };
                            } else {
                                schema = { type: 'object' };
                            }

                            responses[status] = {
                                description: getStatusDescription(status),
                                content: { 'application/json': { schema } },
                            };

                            // Check for error responses
                            if (
                                arg.type === 'ObjectExpression' &&
                                arg.properties.some((p) => p.key.name === 'error')
                            ) {
                                const errorMsg = arg.properties.find((p) => p.key.name === 'error')?.value.value;
                                if (errorMsg) {
                                    errors.push({ status, message: errorMsg });
                                }
                            }
                        }
                    },
                });

                // Refine requestBody schema using model or service validation
                if (requestBody.required.length > 0) {
                    methods[methodName] = {
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: { type: 'object', properties: requestBody.properties, required: requestBody.required },
                                },
                            },
                        },
                        responses,
                        errors,
                    };
                } else {
                    methods[methodName] = { requestBody: null, responses, errors };
                }
            }
        },
    });

    return methods;
}

// Helper to find res.status() call
function findStatusNode(node) {
    let current = node;
    while (current.parent) {
        if (
            current.parent.type === 'CallExpression' &&
            current.parent.callee.type === 'MemberExpression' &&
            current.parent.callee.object.name === 'res' &&
            current.parent.callee.property.name === 'status'
        ) {
            return current.parent;
        }
        current = current.parent;
    }
    return null;
}

// Infer type from AST value
function inferTypeFromValue(valueNode) {
    if (valueNode.type === 'Literal') {
        if (typeof valueNode.value === 'string') return { type: 'string' };
        if (typeof valueNode.value === 'number') return { type: Number.isInteger(valueNode.value) ? 'integer' : 'number' };
        if (typeof valueNode.value === 'boolean') return { type: 'boolean' };
    } else if (valueNode.type === 'ObjectExpression') {
        const properties = {};
        valueNode.properties.forEach((prop) => {
            properties[prop.key.name] = inferTypeFromValue(prop.value);
        });
        return { type: 'object', properties };
    } else if (valueNode.type === 'ArrayExpression') {
        return { type: 'array', items: valueNode.elements[0] ? inferTypeFromValue(valueNode.elements[0]) : { type: 'string' } };
    }
    return { type: 'string' };
}

// Parse service to extract validation rules and errors
function parseService(servicePath) {
    const serviceCode = fs.readFileSync(path.join(__dirname, servicePath), 'utf-8');
    const ast = acorn.parse(serviceCode, { sourceType: 'module', ecmaVersion: 2020 });
    const validationRules = {};
    const errors = [];

    walk.simple(ast, {
        MethodDefinition(node) {
            if (node.key.name === 'validateInput') {
                walk.simple(node.value.body, {
                    IfStatement(node) {
                        if (
                            node.test.type === 'LogicalExpression' ||
                            node.test.type === 'BinaryExpression' ||
                            node.test.type === 'UnaryExpression'
                        ) {
                            const condition = extractCondition(node.test);
                            if (node.consequent.type === 'BlockStatement') {
                                node.consequent.body.forEach((stmt) => {
                                    if (
                                        stmt.type === 'ExpressionStatement' &&
                                        stmt.expression.type === 'CallExpression' &&
                                        stmt.expression.callee.property?.name === 'push'
                                    ) {
                                        const errorMsg = stmt.expression.arguments[0].value;
                                        const field = condition.field;
                                        if (field) {
                                            validationRules[field] = validationRules[field] || {};
                                            if (condition.pattern) validationRules[field].pattern = condition.pattern;
                                            if (condition.minLength) validationRules[field].minLength = condition.minLength;
                                            if (condition.maxLength) validationRules[field].maxLength = condition.maxLength;
                                            errors.push({ status: 400, message: errorMsg });
                                        }
                                    }
                                });
                            }
                        }
                    },
                });
            }
        },
    });

    return { validationRules, errors };
}

// Extract validation condition from AST
function extractCondition(testNode) {
    if (testNode.type === 'UnaryExpression' && testNode.operator === '!') {
        return { field: testNode.argument.name, required: true };
    } else if (
        testNode.type === 'CallExpression' &&
        testNode.callee.type === 'MemberExpression' &&
        testNode.callee.property.name === 'test'
    ) {
        const pattern = testNode.arguments[0].value;
        const field = testNode.callee.object.object?.name;
        return { field, pattern };
    } else if (
        testNode.type === 'LogicalExpression' &&
        testNode.operator === '&&'
    ) {
        const left = extractCondition(testNode.left);
        const right = extractCondition(testNode.right);
        return { ...left, ...right };
    }
    return {};
}

// Get status description
function getStatusDescription(status) {
    const descriptions = {
        200: 'OK',
        201: 'Created',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        500: 'Internal Server Error',
    };
    return descriptions[status] || 'Unknown';
}

// Generate response schema with associations
function getResponseSchema(method, routePath, tag, model, controllerInfo, queryParams) {
    const singularModel = model ? model : pluralize.singular(tag);

    if (tag === 'Locations') {
        const type = queryParams.find((p) => p.name === 'type')?.schema.enum[0] || 'Region';
        const modelName = type.charAt(0).toUpperCase() + type.slice(1);
        if (method === 'get') {
            if (routePath === '/' || routePath === '') {
                return { type: 'array', items: { $ref: `#/components/schemas/${modelName}` } };
            } else if (routePath.includes(':')) {
                return { $ref: `#/components/schemas/${modelName}` };
            }
        } else if (method === 'post' || method === 'put') {
            return { $ref: `#/components/schemas/${modelName}` };
        } else if (method === 'delete') {
            return { type: 'object', properties: { message: { type: 'string' } } };
        }
    } else if (controllerInfo.responses && Object.keys(controllerInfo.responses).length > 0) {
        const primaryStatus = method === 'post' ? 201 : 200;
        return controllerInfo.responses[primaryStatus]?.content['application/json'].schema || { $ref: `#/components/schemas/${singularModel}` };
    } else if (modelSchemas[singularModel]) {
        if (method === 'get') {
            if (routePath === '/' || routePath === '') {
                return { type: 'array', items: { $ref: `#/components/schemas/${singularModel}` } };
            } else if (routePath.includes(':')) {
                return { $ref: `#/components/schemas/${singularModel}` };
            }
        } else if (method === 'post' || method === 'put') {
            return { $ref: `#/components/schemas/${singularModel}` };
        } else if (method === 'delete') {
            return { type: 'object', properties: { message: { type: 'string' } } };
        }
    }

    return { type: 'object' };
}

// Infer query parameters from routes and services
function inferQueryParams(fullPath, tag, servicePath) {
    const queryParams = [];

    if (fullPath.includes('/delegation')) {
        queryParams.push({ name: 'delegationID', in: 'query', schema: { type: 'string' } });
    }
    if (fullPath.includes('/locations')) {
        queryParams.push({
            name: 'type',
            in: 'query',
            schema: { type: 'string', enum: ['region', 'governorate', 'delegation'] },
        });
    }
    if (fullPath.includes('/notifications')) {
        queryParams.push({ name: 'userID', in: 'query', schema: { type: 'string' } });
    }
    if (fullPath.includes('/visits')) {
        queryParams.push({
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['planned', 'completed', 'cancelled'] },
        });
    }

    // Extract from service validation
    if (servicePath) {
        const serviceCode = fs.readFileSync(path.join(__dirname, servicePath), 'utf-8');
        const ast = acorn.parse(serviceCode, { sourceType: 'module', ecmaVersion: 2020 });
        walk.simple(ast, {
            MethodDefinition(node) {
                if (node.key.name.includes('get') || node.key.name.includes('find')) {
                    walk.simple(node.value.body, {
                        CallExpression(node) {
                            if (
                                node.callee.type === 'MemberExpression' &&
                                node.callee.property.name === 'findAll' &&
                                node.arguments[0]?.properties
                            ) {
                                node.arguments[0].properties.forEach((prop) => {
                                    if (prop.key.name === 'where') {
                                        prop.value.properties.forEach((whereProp) => {
                                            const field = whereProp.key.name;
                                            queryParams.push({
                                                name: field,
                                                in: 'query',
                                                schema: { type: 'string' },
                                            });
                                        });
                                    }
                                });
                            }
                        },
                    });
                }
            },
        });
    }

    return [...new Set(queryParams.map((p) => JSON.stringify(p)))].map((p) => JSON.parse(p));
}

// Initialize OpenAPI spec
const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'TraceFlow API',
        description: 'API documentation for the TraceFlow backend, automatically generated from controllers, services, and models.',
        version: '1.0.0',
    },
    servers: [
        { url: process.env.NODE_ENV === 'production' ? process.env.PROD_URL : `${process.env.DEV_URL}:${process.env.PORT}` },
    ],
    components: {
        securitySchemes: {
            BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            CookieAuth: { type: 'apiKey', in: 'cookie', name: 'accessToken' },
        },
        schemas: {
            ErrorResponse: { type: 'object', properties: { error: { type: 'string' } } },
            ValidationErrorResponse: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                    errors: { type: 'array', items: { type: 'string' } },
                },
            },
            ...modelSchemas,
        },
    },
    security: [{ BearerAuth: [] }, { CookieAuth: [] }],
    paths: {},
};

// Process routes
routeMappings.forEach(({ path: basePath, file, tag, controller, service, model }) => {
    try {
        const routeModule = require(file);
        const controllerData = controller ? parseController(controller) : {};
        const serviceData = service ? parseService(service) : { validationRules: {}, errors: [] };
        const routes = routeModule.stack || [];

        routes.forEach((layer) => {
            if (layer.route) {
                const routePath = layer.route.path;
                const fullPath = `${basePath}${routePath === '/' ? '' : routePath}`;
                const methods = layer.route.methods;
                const handler = layer.route.stack[layer.route.stack.length - 1].handle;
                const methodName = handler.name;
                const controllerInfo = controllerData[methodName] || {};
                const hasFileUpload = layer.route.stack.some((middleware) => middleware.handle.name.includes('upload'));

                openApiSpec.paths[fullPath] = openApiSpec.paths[fullPath] || {};
                Object.keys(methods).forEach((method) => {
                    const queryParams = inferQueryParams(fullPath, tag, service);
                    const responseSchema = getResponseSchema(method, routePath, tag, model, controllerInfo, queryParams);

                    // Build request body schema with validation rules
                    let requestBody = controllerInfo.requestBody;
                    if (['post', 'put'].includes(method) && !hasFileUpload) {
                        const modelSchema = model ? modelSchemas[model] : modelSchemas[pluralize.singular(tag)];
                        if (modelSchema) {
                            requestBody = {
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: { ...modelSchema.properties },
                                            required: modelSchema.required || [],
                                        },
                                    },
                                },
                            };
                            // Apply service validation rules
                            Object.keys(serviceData.validationRules).forEach((field) => {
                                if (requestBody.content['application/json'].schema.properties[field]) {
                                    Object.assign(requestBody.content['application/json'].schema.properties[field], serviceData.validationRules[field]);
                                }
                            });
                        }
                    } else if (hasFileUpload) {
                        requestBody = {
                            content: {
                                'multipart/form-data': {
                                    schema: {
                                        type: 'object',
                                        properties: { PFP: { type: 'string', format: 'binary' } },
                                        required: ['PFP'],
                                    },
                                },
                            },
                        };
                    }

                    const operation = {
                        tags: [tag],
                        summary: `${method.toUpperCase()} ${fullPath}`,
                        parameters: [
                            ...extractParameters(routePath),
                            ...queryParams,
                        ],
                        responses: {
                            [method === 'post' ? 201 : 200]: {
                                description: getStatusDescription(method === 'post' ? 201 : 200),
                                content: { 'application/json': { schema: responseSchema } },
                            },
                            400: {
                                description: 'Bad Request',
                                content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } },
                            },
                            401: {
                                description: 'Unauthorized',
                                content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
                            },
                            403: {
                                description: 'Forbidden',
                                content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
                            },
                            404: {
                                description: 'Not Found',
                                content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
                            },
                            500: {
                                description: 'Internal Server Error',
                                content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
                            },
                            ...controllerInfo.errors.reduce((acc, err) => {
                                acc[err.status] = {
                                    description: err.message,
                                    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
                                };
                                return acc;
                            }, {}),
                            ...serviceData.errors.reduce((acc, err) => {
                                acc[err.status] = {
                                    description: err.message,
                                    content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } },
                                };
                                return acc;
                            }, {}),
                        },
                        security: basePath === '/api/auth' ? [] : [{ BearerAuth: [] }, { CookieAuth: [] }],
                        requestBody,
                    };

                    openApiSpec.paths[fullPath][method] = operation;
                });
            }
        });
    } catch (err) {
        console.error(`Error processing route file ${file}: ${err.message}`);
    }
});

// Extract path parameters
function extractParameters(routePath) {
    const params = [];
    const matches = routePath.match(/:([^\/]+)/g);
    if (matches) {
        matches.forEach((match) => {
            const paramName = match.slice(1);
            params.push({
                name: paramName,
                in: 'path',
                required: true,
                schema: { type: 'string' },
            });
        });
    }
    return params;
}

// Write spec to file
fs.writeFileSync(path.join(__dirname, '../openapi.json'), JSON.stringify(openApiSpec, null, 2));
console.log('OpenAPI spec generated at: openapi.json');