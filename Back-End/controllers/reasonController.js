// controllers/reasonController.js
const ReasonService = require('../services/reasonService');

class ReasonController {
    static async createReason(req, res) {
        console.log('create reason', req.body);
        try {
            const { text } = req.body;
            if (!text) {
                return res.status(400).json({ error: 'Reason text is required' });
            }
            const reason = await ReasonService.createItem(text);
            res.status(201).json(reason);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Create reason failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to create reason due to an internal error' });
        }
    }

    static async getReasonsByVisitID(req, res) {
        console.log('get reasons by visit id', req.params);
        try {
            const { id: visitID } = req.params;
            if (!visitID) {
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const reasons = await ReasonService.getReasonsByVisitId(visitID);
            res.status(200).json(reasons);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get reasons by visit ID failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve reasons for visit due to an internal error' });
        }
    }

    static async getAllReasons(req, res) {
        console.log('get all reasons', true);
        try {
            const reasons = await ReasonService.getAllReasons();
            res.status(200).json(reasons);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all reasons failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve all reasons due to an internal error' });
        }
    }
}

module.exports = ReasonController;