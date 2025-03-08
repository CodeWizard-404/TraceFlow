const ChecklistService = require('../services/checklistService');

class ChecklistController {
    static async createChecklist(req, res) {
        try {
            const { text } = req.body;
            const checklist = await ChecklistService.createItem(text);
            res.status(201).json(checklist);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getChecklistsByVisitID(req, res) {
        try {
            const { id: visitID } = req.params;
            const checklists = await ChecklistService.getChecklistsByVisitId(visitID);
            res.status(200).json(checklists);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAllChecklists(req, res) {
        try {
            const checklists = await ChecklistService.getAllChecklists();
            res.status(200).json(checklists);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ChecklistController;