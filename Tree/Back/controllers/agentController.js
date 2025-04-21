const AgentService = require('../services/agentService');
const logger = require('../utils/logger');

class AgentController {
    static async getAgentById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Get agent by ID failed: Missing ID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Agent ID is required' });
            }
            const agent = await AgentService.getAgentById(id);
            logger.info(`Fetched agent ${id} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(agent);
        } catch (error) {
            logger.error(`Get agent by ID error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve agent due to an internal error' });
        }
    }

    static async getAgentByPhone(req, res) {
        try {
            const { phone } = req.params;
            if (!phone) {
                logger.warn(`Get agent by phone failed: Missing phone, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Phone number is required' });
            }
            const agent = await AgentService.getAgentByPhone(phone);
            logger.info(`Fetched agent by phone ${phone} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(agent);
        } catch (error) {
            logger.error(`Get agent by phone error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve agent by phone due to an internal error' });
        }
    }

    static async getAgentsByLocation(req, res) {
        try {
            const { location } = req.query;
            if (!location) {
                logger.warn(`Get agents by location failed: Missing location, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Location is required' });
            }
            const agents = await AgentService.getAgentsByLocation(location);
            logger.info(`Fetched agents by location ${location} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(agents);
        } catch (error) {
            logger.error(`Get agents by location error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve agents by location due to an internal error' });
        }
    }

    static async getAllUniqueLocations(req, res) {
        try {
            const locations = await AgentService.getAllUniqueLocations();
            logger.info(`Fetched unique locations by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(locations);
        } catch (error) {
            logger.error(`Get unique locations error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve unique locations due to an internal error' });
        }
    }
}

module.exports = AgentController;