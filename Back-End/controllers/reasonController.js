const ReasonService = require('../services/reasonService');

class ReasonController {
    static async createReason(req, res) {
        try {
            const { text } = req.body;
            const reason = await ReasonService.createItem(text);
            res.status(201).json(reason);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getReasonsByVisitID(req, res) {
        try {
            const { id: visitID } = req.params;
            const reasons = await ReasonService.getReasonsByVisitId(visitID);
            res.status(200).json(reasons);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAllChecklists(req, res) {
        try {
            const checklists = await ReasonService.getAllReasons();
            res.status(200).json(checklists);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ReasonController;