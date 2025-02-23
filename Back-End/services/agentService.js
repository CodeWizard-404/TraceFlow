const { Agent } = require('../models');

class AgentService {
    static async findAgentById(id) {
        return Agent.findByPk(id);
    }

    static async findAgentsByLocation(location) {
        return Agent.findAll({ where: { location } });
    }

    static async findUniqueLocations() {
        const locations = await Agent.findAll({
            attributes: ['location'],
            group: ['location'],
        });
        return locations.map((loc) => loc.location);
    }

    static async findAgentByPhone(phone) {
        return Agent.findOne({ where: { phone } });
    }
    
}

module.exports = AgentService;