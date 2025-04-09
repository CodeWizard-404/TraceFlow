const VisitService = require('../services/visitService');

class VisitController {
    static async verifyQRCode(req, res) {
        console.log('verifyQRCode', req.body);
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
        console.log('logVisit', req.body, req.params, req.files);
        try {
            const { id } = req.params;
            const { duration, checklistUpdates, comment } = req.body;
            const files = req.files;
            const visit = await VisitService.logVisit(id, { duration, checklistUpdates, comment }, files);
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

    static async updateVisit(req, res) {
        console.log('updateVisit', req.body, req.params, req.files);
        try {
            const { id } = req.params;
            const data = req.body;
            const files = req.files || [];
            const visit = await VisitService.updateVisit(id, data, files);
            res.status(200).json(visit);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update visit failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to update visit due to an internal error' });
        }
    }

    static async deleteVisit(req, res) {
        console.log('deleteVisit', req.params);
        try {
            const { id } = req.params;
            const result = await VisitService.deleteVisit(id);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Delete visit failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to delete visit due to an internal error' });
        }
    }
}

module.exports = VisitController;