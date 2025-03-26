// controllers/visitController.js
const VisitService = require('../services/visitService');

class VisitController {
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
