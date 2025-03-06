// services/checklistService.js
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
        const visitChecklist = await VisitChecklist.findOne({
            where: { visitID: visitId, checklistID: checklistId }
        });
        if (visitChecklist) {
            visitChecklist.checked = checked;
            await visitChecklist.save();
        }
        return visitChecklist;
    }
}

module.exports = ChecklistService;