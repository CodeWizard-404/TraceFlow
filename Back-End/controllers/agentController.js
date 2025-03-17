// controllers/agentController.js
const AgentService = require('../services/agentService');

class AgentController {
    static async getAgentById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Agent ID is required' });
            }
            const agent = await AgentService.getAgentById(id);
            res.json(agent);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get agent by ID failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve agent due to an internal error' });
        }
    }

    static async getAgentByPhone(req, res) {
        try {
            const { phone } = req.params;
            if (!phone) {
                return res.status(400).json({ error: 'Phone number is required' });
            }
            const agent = await AgentService.getAgentByPhone(phone);
            res.json(agent);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get agent by phone failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve agent by phone due to an internal error' });
        }
    }

    static async getAgentsByLocation(req, res) {
        try {
            const { location } = req.query;
            if (!location) {
                return res.status(400).json({ error: 'Location is required' });
            }
            const agents = await AgentService.getAgentsByLocation(location);
            res.json(agents);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get agents by location failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve agents by location due to an internal error' });
        }
    }

    static async getAllUniqueLocations(req, res) {
        try {
            const locations = await AgentService.getAllUniqueLocations();
            res.json(locations);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get unique locations failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve unique locations due to an internal error' });
        }
    }
}

module.exports = AgentController;