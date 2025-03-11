const { Reason, Visit } = require('../models');

class ReasonService {
    static async createItem(text) {
        return Reason.create({ item: text });
    }

    static async getItemsByIds(ids) {
        const items = await Reason.findAll({ where: { reasonID: ids } });
        if (items.length !== ids.length) {
            throw new Error('One or more reason IDs do not exist');
        }
        return items;
    }

    static async getReasonsByVisitId(visitId) {
        const visit = await Visit.findByPk(visitId, { include: Reason });
        return visit.Reasons;
    }

    static async getAllReasons() {
        return Reason.findAll();
    }
}

module.exports = ReasonService;