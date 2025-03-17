// controllers/visitController.js
const VisitService = require('../services/visitService');

class VisitController {
    static async createVisit(req, res) {
        try {
            const { date, time, agentID, supervisorID, timesheetID, reasons, checklists } = req.body;
            if (!date || !time || !agentID || !supervisorID || !timesheetID) {
                return res.status(400).json({ error: 'Missing required fields: date, time, agentID, supervisorID, and timesheetID are mandatory' });
            }
            if (!Array.isArray(reasons) || reasons.length === 0) {
                return res.status(400).json({ error: 'At least one reason is required' });
            }
            if (!Array.isArray(checklists) || checklists.length === 0) {
                return res.status(400).json({ error: 'At least one checklist item is required' });
            }
            const visit = await VisitService.createVisit({
                date,
                time,
                agentID,
                supervisorID,
                timesheetID,
                reasons,
                checklists,
            });
            res.status(201).json(visit);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Create visit failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to create visit due to an internal error' });
        }
    }

    static async verifyQRCode(req, res) {
        try {
            const { qrData, visitId } = req.body;
            if (!qrData || !visitId) {
                return res.status(400).json({ error: 'Missing required parameters: qrData and visitId are mandatory' });
            }
            const result = await VisitService.verifyQRCode(qrData, visitId);
            res.status(result.valid ? 200 : 400).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - QR verification failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to verify QR code due to an internal error' });
        }
    }

    static async logVisit(req, res) {
        try {
            const { id } = req.params;
            const { duration, checklistUpdates, photos, comment } = req.body;
            if (!duration) {
                return res.status(400).json({ error: 'Duration is required to log a visit' });
            }
            const visit = await VisitService.logVisit(id, { duration, checklistUpdates, photos, comment });
            res.status(200).json(visit);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Log visit failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to log visit due to an internal error' });
        }
    }

    static async getVisitByID(req, res) {
        try {
            const { id } = req.params;
            const visit = await VisitService.getVisitByID(id);
            res.status(200).json(visit);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get visit failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve visit due to an internal error' });
        }
    }
}

module.exports = VisitController;
