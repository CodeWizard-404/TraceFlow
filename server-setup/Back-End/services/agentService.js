const { Agent } = require('../models');

class AgentService {
    static async getAgentById(id) {
        const agent = await Agent.findByPk(id);
        if (!agent) {
            const error = new Error('Agent not found');
            error.status = 404;
            throw error;
        }
        return agent;
    }

    static async getAgentByPhone(phone) {
        const agent = await Agent.findOne({ where: { phone } });
        if (!agent) {
            const error = new Error('Agent not found');
            error.status = 404;
            throw error;
        }
        return agent;
    }

    static async getAgentsByLocation(location) {
        if (!location) {
            const error = new Error('Location is required');
            error.status = 400;
            throw error;
        }
        const agents = await Agent.findAll({ where: { location } });
        return agents;
    }

    static async getAllUniqueLocations() {
        const locations = await Agent.findAll({
            attributes: ['location'],
            group: ['location'],
        });
        const uniqueLocations = locations.map((loc) => loc.location);
        return uniqueLocations;
    }
}

module.exports = AgentService;