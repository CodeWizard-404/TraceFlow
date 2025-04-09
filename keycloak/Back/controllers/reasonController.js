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

    static async updateReason(req, res) {
        console.log('update reason', req.params, req.body);
        try {
            const { id: reasonID } = req.params;
            const { text } = req.body;
            if (!reasonID || !text) {
                return res.status(400).json({ error: 'Reason ID and text are required' });
            }
            const reason = await ReasonService.updateItem(reasonID, text);
            res.status(200).json(reason);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update reason failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to update reason due to an internal error' });
        }
    }

    static async deleteReason(req, res) {
        console.log('delete reason', req.params);
        try {
            const { id: reasonID } = req.params;
            if (!reasonID) {
                return res.status(400).json({ error: 'Reason ID is required' });
            }
            await ReasonService.deleteItem(reasonID);
            res.status(204).send();
        } catch (error) {
            console.error(`${new Date().toISOString()} - Delete reason failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to delete reason due to an internal error' });
        }
    }

    static async getReasonByID(req, res) {
        console.log('get reason by id', req.params);
        try {
            const { id: reasonID } = req.params;
            if (!reasonID) {
                return res.status(400).json({ error: 'Reason ID is required' });
            }
            const reason = await ReasonService.getItemByID(reasonID);
            res.status(200).json(reason);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get reason by ID failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve reason due to an internal error' });
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