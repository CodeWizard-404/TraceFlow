const VisitService = require('../services/visitService');

const VisitController = {
    async createVisit(req, res) {
        try {
            const { date, time, location, agentID, supervisorID, timesheetID } = req.body;
            // Validate required fields
            if (!date || !time || !location || !agentID || !supervisorID || !timesheetID) {
                return res.status(400).json({ error: 'Invalid input data' });
            }
            const visit = await VisitService.createVisit({
                date,
                time,
                location,
                agentID,
                supervisorID,
                timesheetID,
            });
            res.status(201).json(visit);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async verifyQRCode(req, res) {
        try {
            const { qrData, visitId } = req.body;
            if (!qrData || !visitId) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }

            const result = await VisitService.verifyQRCode(qrData, visitId);
            return res.status(result.valid ? 200 : 400).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async logVisit(req, res) {
        try {
            const { id } = req.params;
            const { duration, reason, checklist } = req.body;
            if (!reason || !checklist) {
                return res.status(400).json({ error: 'Invalid input data' });
            }
            const visit = await VisitService.logVisit(id, {
                duration,
                reason,
                checklist
            });
            res.status(200).json(visit);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getVisitByID(req, res) {
        try {
            const { id } = req.params;
            const visit = await VisitService.getVisitByID(id);
            res.status(200).json(visit);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
};

module.exports = VisitController;