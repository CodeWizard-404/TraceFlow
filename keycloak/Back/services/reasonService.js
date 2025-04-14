const { Reason, Visit } = require('../models');
const logger = require('../utils/logger');

class ReasonService {
    static async createItem(text, actorID) {
        try {
            const reason = await Reason.create({ item: text });
            logger.info(`Reason created by user ${actorID}`, { ip: null });
            return reason;
        } catch (error) {
            logger.error(`Create reason error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error('Failed to create reason: ' + error.message);
        }
    }

    static async updateItem(id, text, actorID) {
        try {
            const item = await Reason.findByPk(id);
            if (!item) {
                const error = new Error('Reason item not found');
                error.status = 404;
                throw error;
            }
            item.item = text;
            await item.save();
            logger.info(`Reason ${id} updated by user ${actorID}`, { ip: null });
            return item;
        } catch (error) {
            logger.error(`Update reason error: ${error.message}, user: ${actorID}`, { ip: null });
            throw error;
        }
    }

    static async deleteItem(id, actorID) {
        try {
            const item = await Reason.findByPk(id);
            if (!item) {
                const error = new Error('Reason item not found');
                error.status = 404;
                throw error;
            }
            await item.destroy();
            logger.info(`Reason ${id} deleted by user ${actorID}`, { ip: null });
            return item;
        } catch (error) {
            logger.error(`Delete reason error: ${error.message}, user: ${actorID}`, { ip: null });
            throw error;
        }
    }

    static async getItemById(id) {
        try {
            const item = await Reason.findByPk(id);
            if (!item) {
                const error = new Error('Reason item not found');
                error.status = 404;
                throw error;
            }
            return item;
        } catch (error) {
            logger.error(`Get reason error: ${error.message}`, { ip: null });
            throw error;
        }
    }

    static async getItemsByIds(ids) {
        try {
            const items = await Reason.findAll({ where: { reasonID: ids } });
            if (items.length !== ids.length) {
                const error = new Error('One or more reason IDs do not exist');
                error.status = 404;
                throw error;
            }
            return items;
        } catch (error) {
            logger.error(`Get reasons by IDs error: ${error.message}`, { ip: null });
            throw error;
        }
    }

    static async getReasonsByVisitId(visitId) {
        try {
            const visit = await Visit.findByPk(visitId, { include: Reason });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            return visit.Reasons;
        } catch (error) {
            logger.error(`Get reasons by visit error: ${error.message}`, { ip: null });
            throw error;
        }
    }

    static async getAllReasons() {
        try {
            return await Reason.findAll();
        } catch (error) {
            logger.error(`Get all reasons error: ${error.message}`, { ip: null });
            throw new Error('Failed to retrieve reasons: ' + error.message);
        }
    }
}

module.exports = ReasonService;