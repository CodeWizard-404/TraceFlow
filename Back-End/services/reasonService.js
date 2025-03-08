const { Reason, Visit } = require('../models');

class ReasonService {
    static async createItem(text) {
        return Reason.create({ item: text });
    }

    static async findOrCreateItems(items) {
        const created = [];
        for (const item of items) {
            if (item.id) {
                created.push(await Reason.findByPk(item.id));
            } else {
                created.push(await this.createItem(item.text));
            }
        }
        return created;
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