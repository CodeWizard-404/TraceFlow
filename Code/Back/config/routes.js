const { authenticateCookie } = require('./security');
const agentRoutes = require('../routes/agentRoutes');
const authRoutes = require('../routes/authRoutes');
const checklistRoutes = require('../routes/checklistRoutes');
const permissionRoutes = require('../routes/permissionRoutes');
const reasonRoutes = require('../routes/reasonRoutes');
const receiptBookRoutes = require('../routes/receiptBookRoutes');
const receiptstubRoutes = require('../routes/receiptStubRoutes');
const roleRoutes = require('../routes/roleRoutes');
const timesheetRoutes = require('../routes/timesheetRoutes');
const userRoutes = require('../routes/userRoutes');
const visitRoutes = require('../routes/visitRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const locationRoutes = require('../routes/locationRoutes');
const csvHeaderRoutes = require('../routes/csvHeaderRoutes');
const { initializeRedis } = require('./redis');
const logger = require('../utils/logger');

function setupRoutes(app) {
    app.use('/api/auth', authRoutes);
    app.use('/api/users', authenticateCookie, userRoutes);
    app.use('/api/roles', authenticateCookie, roleRoutes);
    app.use('/api/permissions', authenticateCookie, permissionRoutes);
    app.use('/api/visits', authenticateCookie, visitRoutes);
    app.use('/api/checklists', authenticateCookie, checklistRoutes);
    app.use('/api/reasons', authenticateCookie, reasonRoutes);
    app.use('/api/timesheets', authenticateCookie, timesheetRoutes);
    app.use('/api/agents', authenticateCookie, agentRoutes);
    app.use('/api/receipt-books', authenticateCookie, receiptBookRoutes);
    app.use('/api/receipt-stubs', authenticateCookie, receiptstubRoutes);
    app.use('/api/notifications', authenticateCookie, notificationRoutes);
    app.use('/api/locations', authenticateCookie, locationRoutes);
    app.use('/api/csv-headers', authenticateCookie, csvHeaderRoutes);

    // Test endpoint
    app.get('/api/test', authenticateCookie, (req, res) => {
        res.json({ message: 'Secure endpoint accessed', user: req.user });
    });

    // Redis test endpoint
    app.get('/api/test/redis', authenticateCookie, async (req, res) => {
        try {
            const redisClient = await initializeRedis();
            await redisClient.set('test', 'Redis is working', 'EX', 60);
            const result = await redisClient.get('test');
            logger.info('Redis test endpoint successful');
            res.json({ message: 'Redis test successful', result });
        } catch (error) {
            logger.error(`Redis test error: ${error.message}`);
            res.status(500).json({ error: 'Redis test failed', details: error.message });
        }
    });

    // Error handling
    app.use((err, req, res, next) => {
        logger.error(`Server error: ${err.stack}`, { ip: req.ip });
        res.status(500).json({ error: 'Something went wrong!' });
    });
}

module.exports = { setupRoutes };