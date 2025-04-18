const VisitService = require('../services/visitService');
const logger = require('../utils/logger');

class VisitController {
    static async verifyQRCode(req, res) {
        try {
            const { qrData, visitId } = req.body;
            if (!qrData || !visitId) {
                logger.warn(`Verify QR code failed: Missing qrData or visitId, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Missing required parameters: qrData and visitId are mandatory' });
            }
            const result = await VisitService.verifyQRCode(qrData, visitId, req.user.userID);
            logger.info(`QR code verified for visit ${visitId} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(result.valid ? 200 : 400).json(result);
        } catch (error) {
            logger.error(`QR verification error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to verify QR code due to an internal error' });
        }
    }

    static async logVisit(req, res) {
        try {
            const { id } = req.params;
            const { duration, checklistUpdates, comment } = req.body;
            const files = req.files || [];
            if (!id) {
                logger.warn(`Log visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await VisitService.logVisit(id, { duration, checklistUpdates, comment }, files, req.user.userID);
            logger.info(`Visit ${id} logged by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(visit);
        } catch (error) {
            logger.error(`Log visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to log visit due to an internal error' });
        }
    }

    static async getVisitByID(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Get visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await VisitService.getVisitByID(id);
            logger.info(`Fetched visit ${id} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(visit);
        } catch (error) {
            logger.error(`Get visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to retrieve visit due to an internal error' });
        }
    }

    static async updateVisit(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const files = req.files || [];
            if (!id) {
                logger.warn(`Update visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const visit = await VisitService.updateVisit(id, data, files, req.user.userID);
            logger.info(`Updated visit ${id} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(visit);
        } catch (error) {
            logger.error(`Update visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to update visit due to an internal error' });
        }
    }

    static async deleteVisit(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                logger.warn(`Delete visit failed: Missing visit ID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const result = await VisitService.deleteVisit(id, req.user.userID);
            logger.info(`Deleted visit ${id} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Delete visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to delete visit due to an internal error' });
        }
    }
}

module.exports = VisitController;