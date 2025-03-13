const VisitService = require('../services/visitService');

class VisitController {
    static async createVisit(req, res) {
        try {
            const { date, time, agentID, supervisorID, timesheetID, reasons, checklists } = req.body;
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
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }

    static async verifyQRCode(req, res) {
        try {
            const { qrData, visitId } = req.body;
            const result = await VisitService.verifyQRCode(qrData, visitId);
            res.status(result.valid ? 200 : 400).json(result);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }

    static async logVisit(req, res) {
        try {
            const { id } = req.params;
            const { duration, checklistUpdates, photos, comment } = req.body;
            const visit = await VisitService.logVisit(id, { duration, checklistUpdates, photos, comment });
            res.status(200).json(visit);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }

    static async getVisitByID(req, res) {
        try {
            const { id } = req.params;
            const visit = await VisitService.getVisitByID(id);
            res.status(200).json(visit);
        } catch (error) {
            console.error(error);
            res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
        }
    }
};

module.exports = VisitController;
