const VisitService = require('../services/visitService');

const VisitController = {
    async createVisit(req, res) {
        try {
            const {
                date,
                time,
                location,
                agentID,
                supervisorID,
                timesheetID,
                reasons,
                checklist
            } = req.body;

            // Validate required fields
            if (!date || !time || !location || !agentID || !supervisorID || !timesheetID) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Create visit with associations
            const visit = await VisitService.createVisit({
                date,
                time,
                location,
                agentID,
                supervisorID,
                timesheetID,
                reasons,
                checklist
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
            const { duration, checklistUpdates, photos, comment } = req.body;
            const visit = await VisitService.logVisit(id, {
                duration,
                checklistUpdates,
                photos,
                comment
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