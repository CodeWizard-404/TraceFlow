const { Checklist, Visit, VisitChecklist } = require('../models');

class ChecklistService {
    static async createItem(text) {
        return Checklist.create({ item: text });
    }

    static async getItemsByIds(ids) {
        const items = await Checklist.findAll({ where: { checklistID: ids } });
        if (items.length !== ids.length) {
            throw new Error('One or more checklist IDs do not exist');
        }
        return items;
    }

    static async getChecklistsByVisitId(visitId) {
        const visit = await Visit.findByPk(visitId, { include: Checklist });
        return visit.Checklists;
    }

    static async updateChecklistStatus(visitId, checklistId, checked) {
        try {
            const visitChecklist = await VisitChecklist.findOne({
                where: { visitID: visitId, checklistID: checklistId },
            });
            if (!visitChecklist) throw new Error('Checklist item not found');
            visitChecklist.checked = checked;
            await visitChecklist.save();
            return visitChecklist;
        } catch (error) {
            throw new Error('Failed to update checklist: ' + error.message);
        }
    }

    static async getAllChecklists() {
        return Checklist.findAll();
    }
}

module.exports = ChecklistService;