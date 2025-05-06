const swaggerAutogen = require('swagger-autogen')();
require('dotenv').config();

const doc = {
  info: {
    title: 'TraceFlow API',
    description: 'API documentation for the TraceFlow backend, automatically generated.',
    version: '1.0.0',
  },
  host: process.env.NODE_ENV === 'production' ? process.env.PROD_URL.replace(/^https?:\/\//, '') : `${process.env.DEV_URL.replace(/^https?:\/\//, '')}:${process.env.PORT}`,
  schemes: [process.env.NODE_ENV === 'production' ? 'https' : 'http'],
  securityDefinitions: {
    BearerAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'Authorization',
      description: 'Enter your Bearer token in the format: Bearer <token>',
    },
    CookieAuth: {
      type: 'apiKey',
      in: 'cookie',
      name: 'accessToken',
      description: 'Access token stored in cookie for authentication',
    },
  },
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  definitions: {
    ErrorResponse: {
      error: 'string',
    },
  },
};

const outputFile = '../swagger-output.json';
const routes = ['../routes/*.js'];

swaggerAutogen(outputFile, routes, doc).then(() => {
  console.log('Swagger documentation generated at:', outputFile);
}).catch((err) => {
  console.error('Error generating Swagger documentation:', err);
});