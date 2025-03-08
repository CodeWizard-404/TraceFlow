const { Checklist, Visit, VisitChecklist } = require('../models');

class ChecklistService {
    static async createItem(text) {
        return Checklist.create({ item: text });
    }

    static async findOrCreateItems(items) {
        const created = [];
        for (const item of items) {
            if (item.id) {
                created.push(await Checklist.findByPk(item.id));
            } else {
                created.push(await this.createItem(item.text));
            }
        }
        return created;
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