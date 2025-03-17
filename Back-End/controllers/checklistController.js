// controllers/checklistController.js
const ChecklistService = require('../services/checklistService');
const { authenticateJWT, requirePermission } = require('../config/security');

class ChecklistController {
    static async createChecklist(req, res) {
        try {
            const { text } = req.body;
            if (!text) {
                return res.status(400).json({ error: 'Checklist text is required' });
            }
            const checklist = await ChecklistService.createItem(text);
            res.status(201).json(checklist);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Create checklist failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to create checklist due to an internal error' });
        }
    }

    static async getChecklistsByVisitID(req, res) {
        try {
            const { id: visitID } = req.params;
            if (!visitID) {
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const checklists = await ChecklistService.getChecklistsByVisitId(visitID);
            res.status(200).json(checklists);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get checklists by visit ID failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve checklists for visit due to an internal error' });
        }
    }

    static async getAllChecklists(req, res) {
        try {
            const checklists = await ChecklistService.getAllChecklists();
            res.status(200).json(checklists);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all checklists failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve all checklists due to an internal error' });
        }
    }
}

module.exports = ChecklistController;