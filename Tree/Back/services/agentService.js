const { Agent } = require('../models');
const logger = require('../utils/logger');

class AgentService {
    static async getAgentById(id) {
        try {
            const agent = await Agent.findByPk(id);
            if (!agent) {
                const error = new Error('Agent not found');
                error.status = 404;
                throw error;
            }
            return agent;
        } catch (error) {
            logger.error(`Get agent by ID error: ${error.message}`, { ip: null });
            throw error;
        }
    }

    static async getAgentByPhone(phone) {
        try {
            const agent = await Agent.findOne({ where: { phone } });
            if (!agent) {
                const error = new Error('Agent not found');
                error.status = 404;
                throw error;
            }
            return agent;
        } catch (error) {
            logger.error(`Get agent by phone error: ${error.message}`, { ip: null });
            throw error;
        }
    }

    static async getAgentsByLocation(location) {
        if (!location) {
            const error = new Error('Location is required');
            error.status = 400;
            throw error;
        }
        try {
            const agents = await Agent.findAll({ where: { location } });
            return agents;
        } catch (error) {
            logger.error(`Get agents by location error: ${error.message}`, { ip: null });
            throw error;
        }
    }

    static async getAllUniqueLocations() {
        try {
            const locations = await Agent.findAll({
                attributes: ['location'],
                group: ['location'],
            });
            const uniqueLocations = locations.map((loc) => loc.location);
            return uniqueLocations;
        } catch (error) {
            logger.error(`Get unique locations error: ${error.message}`, { ip: null });
            const err = new Error('Failed to retrieve unique locations: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }
}

module.exports = AgentService;