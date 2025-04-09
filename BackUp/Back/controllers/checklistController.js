// controllers/checklistController.js
const ChecklistService = require('../services/checklistService');
const { authenticateJWT, requirePermission } = require('../config/security');

class ChecklistController {
    static async createChecklist(req, res) {

        console.log('Creating Checklist', req.body);
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

    static async updateChecklist(req, res) {
        console.log('Updating Checklist', req.params, req.body);
        try {
            const { id: checklistID } = req.params;
            const { text } = req.body;
            if (!checklistID || !text) {
                return res.status(400).json({ error: 'Checklist ID and text are required' });
            }
            const checklist = await ChecklistService.updateItem(checklistID, text);
            res.status(200).json(checklist);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update checklist failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to update checklist due to an internal error' });
        }
    }

    static async deleteChecklist(req, res) {
        console.log('Deleting Checklist', req.params);
        try {
            const { id: checklistID } = req.params;
            if (!checklistID) {
                return res.status(400).json({ error: 'Checklist ID is required' });
            }
            await ChecklistService.deleteItem(checklistID);
            res.status(204).send();
        } catch (error) {
            console.error(`${new Date().toISOString()} - Delete checklist failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to delete checklist due to an internal error' });
        }
    }

    static async getChecklistByID(req, res) {
        console.log('Getting Checklist by ID', req.params);
        try {
            const { id: checklistID } = req.params;
            if (!checklistID) {
                return res.status(400).json({ error: 'Checklist ID is required' });
            }
            const checklist = await ChecklistService.getItemById(checklistID);
            res.status(200).json(checklist);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get checklist by ID failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve checklist due to an internal error' });
        }
    }

    static async getChecklistsByVisitID(req, res) {

        console.log('Getting Checklists by Visit ID', req.params);
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

        console.log('Getting all Checklists', true);
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