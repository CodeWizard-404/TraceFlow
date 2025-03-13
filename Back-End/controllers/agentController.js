const AgentService = require('../services/agentService');

class AgentController {
    static async getAgentById(req, res) {
        try {
            const { id } = req.params;
            const agent = await AgentService.getAgentById(id);
            res.json(agent);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }

    static async getAgentByPhone(req, res) {
        try {
            const { phone } = req.params;
            const agent = await AgentService.getAgentByPhone(phone);
            res.json(agent);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }

    static async getAgentsByLocation(req, res) {
        try {
            const { location } = req.query;
            const agents = await AgentService.getAgentsByLocation(location);
            res.json(agents);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }

    static async getAllUniqueLocations(req, res) {
        try {
            const locations = await AgentService.getAllUniqueLocations();
            res.json(locations);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }
}

module.exports = AgentController;