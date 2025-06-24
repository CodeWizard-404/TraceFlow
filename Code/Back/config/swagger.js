const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'API documentation for my Node.js application',
    },
    servers: [
      {
        url: 'http://localhost:5000',
      },
    ],
  },
  apis: [
    './routes/agentRoutes.js',
    './routes/aiRoutes.js',
    './routes/authRoutes.js',
    './routes/checklistRoutes.js',
    './routes/csvHeaderRoutes.js',
    './routes/reasonRoutes.js',
    './routes/receiptStubRoutes.js',
    './routes/reportRoutes.js',
    './routes/roleRoutes.js',
    './routes/systemRoutes.js',
    './routes/timesheetRoutes.js',
    './routes/visitRoutes.js',
    './routes/locationRoutes.js',
    './routes/receiptBookRoutes.js',
    './routes/permissionRoutes.js',
    './routes/notificationRoutes.js',
    './routes/userRoutes.js'
  ],
  failOnErrors: true, // Enable strict parsing to catch errors
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;