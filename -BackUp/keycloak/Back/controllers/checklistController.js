const ChecklistService = require('../services/checklistService');
const logger = require('../utils/logger');

class ChecklistController {
    static async createChecklist(req, res) {
        try {
            const { text } = req.body;
            if (!text) {
                logger.warn(`Create checklist failed: Missing text, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Checklist text is required' });
            }
            const checklist = await ChecklistService.createItem(text, req.user.userID);
            logger.info(`Checklist created by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(201).json(checklist);
        } catch (error) {
            logger.error(`Create checklist error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to create checklist due to an internal error' });
        }
    }

    static async updateChecklist(req, res) {
        try {
            const { id: checklistID } = req.params;
            const { text } = req.body;
            if (!checklistID || !text) {
                logger.warn(`Update checklist failed: Missing checklistID or text, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Checklist ID and text are required' });
            }
            const checklist = await ChecklistService.updateItem(checklistID, text, req.user.userID);
            logger.info(`Checklist ${checklistID} updated by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(checklist);
        } catch (error) {
            logger.error(`Update checklist error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to update checklist due to an internal error' });
        }
    }

    static async deleteChecklist(req, res) {
        try {
            const { id: checklistID } = req.params;
            if (!checklistID) {
                logger.warn(`Delete checklist failed: Missing checklistID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Checklist ID is required' });
            }
            await ChecklistService.deleteItem(checklistID, req.user.userID);
            logger.info(`Checklist ${checklistID} deleted by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(204).send();
        } catch (error) {
            logger.error(`Delete checklist error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to delete checklist due to an internal error' });
        }
    }

    static async getChecklistByID(req, res) {
        try {
            const { id: checklistID } = req.params;
            if (!checklistID) {
                logger.warn(`Get checklist failed: Missing checklistID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Checklist ID is required' });
            }
            const checklist = await ChecklistService.getItemById(checklistID);
            logger.info(`Fetched checklist ${checklistID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(checklist);
        } catch (error) {
            logger.error(`Get checklist error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to retrieve checklist due to an internal error' });
        }
    }

    static async getChecklistsByVisitID(req, res) {
        try {
            const { id: visitID } = req.params;
            if (!visitID) {
                logger.warn(`Get checklists by visit failed: Missing visitID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const checklists = await ChecklistService.getChecklistsByVisitId(visitID);
            logger.info(`Fetched checklists for visit ${visitID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(checklists);
        } catch (error) {
            logger.error(`Get checklists by visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to retrieve checklists for visit due to an internal error' });
        }
    }

    static async getAllChecklists(req, res) {
        try {
            const checklists = await ChecklistService.getAllChecklists();
            logger.info(`Fetched all checklists by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(checklists);
        } catch (error) {
            logger.error(`Get all checklists error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to retrieve all checklists due to an internal error' });
        }
    }
}

module.exports = ChecklistController;