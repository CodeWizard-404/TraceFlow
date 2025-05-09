const { Reason, Visit } = require('../models');

class ReasonService {
    static async createItem(text, actorID) {
        try {
            const reason = await Reason.create({ item: text });
            return reason;
        } catch (error) {
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
            return item;
        } catch (error) {
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
            return item;
        } catch (error) {
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
            throw error;
        }
    }

    static async getAllReasons() {
        try {
            return await Reason.findAll();
        } catch (error) {
            throw new Error('Failed to retrieve reasons: ' + error.message);
        }
    }
}

module.exports = ReasonService;