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
        try {
            const { id } = req.params;
            const userPermissions = req.user?.Roles?.flatMap(role => role.Permissions?.map(perm => perm.name) || []) || [];
            if (!userPermissions.includes('edit_timesheets_for_supervisor')) {
                return res.status(403).json({ error: 'Permission denied: Only users with edit_timesheets_for_supervisor can update visits' });
            }
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
        try {
            const { id } = req.params;
            const userPermissions = req.user?.Roles?.flatMap(role => role.Permissions?.map(perm => perm.name) || []) || [];
            if (!userPermissions.includes('delete_timesheets_for_supervisor')) {
                return res.status(403).json({ error: 'Permission denied: Only users with delete_timesheets_for_supervisor can delete visits' });
            }
            const result = await VisitService.deleteVisit(id);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Delete visit failed:`, error);
            res.status(error.status || 500).json({ error: error.message || 'Failed to delete visit due to an internal error' });
        }
    }
}

module.exports = VisitController;