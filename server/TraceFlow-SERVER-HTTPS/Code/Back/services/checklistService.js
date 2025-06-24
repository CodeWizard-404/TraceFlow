const { Checklist, Visit, VisitChecklist } = require('../models');

class ChecklistService {
    static async createItem(text, actorID) {
        try {
            const checklist = await Checklist.create({ item: text });
            return checklist;
        } catch (error) {
            throw new Error('Failed to create checklist: ' + error.message);
        }
    }

    static async updateItem(id, text, actorID) {
        try {
            const item = await Checklist.findByPk(id);
            if (!item) {
                const error = new Error('Checklist item not found');
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
            const item = await Checklist.findByPk(id);
            if (!item) {
                const error = new Error('Checklist item not found');
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
            const item = await Checklist.findByPk(id);
            if (!item) {
                const error = new Error('Checklist item not found');
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
            const items = await Checklist.findAll({ where: { checklistID: ids } });
            if (items.length !== ids.length) {
                const error = new Error('One or more checklist IDs do not exist');
                error.status = 404;
                throw error;
            }
            return items;
        } catch (error) {
            throw error;
        }
    }

    static async getChecklistsByVisitId(visitId) {
        try {
            const visit = await Visit.findByPk(visitId, {
                include: [{ model: Checklist, through: { attributes: ['checked'] } }],
            });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            return visit.Checklists;
        } catch (error) {
            throw error;
        }
    }

    static async updateChecklistStatus(visitId, checklistId, checked) {
        try {
            const visitChecklist = await VisitChecklist.findOne({
                where: { visitID: visitId, checklistID: checklistId },
            });
            if (!visitChecklist) {
                const error = new Error('Checklist item not found for this visit');
                error.status = 404;
                throw error;
            }
            visitChecklist.checked = checked;
            await visitChecklist.save();
            return visitChecklist;
        } catch (error) {
            throw new Error('Failed to update checklist: ' + error.message);
        }
    }

    static async getAllChecklists() {
        try {
            return await Checklist.findAll();
        } catch (error) {
            throw new Error('Failed to retrieve checklists: ' + error.message);
        }
    }
}

module.exports = ChecklistService;