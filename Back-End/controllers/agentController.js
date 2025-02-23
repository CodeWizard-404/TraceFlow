// controllers/agentController.js
const { Agent } = require('../models');

class AgentController {
    // Fetch an agent by ID
    static async getAgentById(req, res) {
        try {
            const { id } = req.params;
            const agent = await Agent.findByPk(id);
            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }
            res.json(agent);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Fetch an agent by phone number
    static async getAgentByPhone(req, res) {
        try {
            const { phone } = req.params; // Expect phone number as a URL parameter
            const agent = await Agent.findOne({ where: { phone } });
            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }
            res.json(agent);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Fetch agents by location
    static async getAgentsByLocation(req, res) {
        try {
            const { location } = req.query;
            if (!location) {
                return res.status(400).json({ error: 'Location is required' });
            }
            const agents = await Agent.findAll({ where: { location } });
            res.json(agents);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Fetch all unique agent locations
    static async getAllUniqueLocations(req, res) {
        try {
            const locations = await Agent.findAll({
                attributes: ['location'], // Select only the 'location' column
                group: ['location'],     // Group by 'location' to ensure uniqueness
            });
            const uniqueLocations = locations.map((loc) => loc.location); // Extract location values
            res.json(uniqueLocations); // Return the array of unique locations
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = AgentController;