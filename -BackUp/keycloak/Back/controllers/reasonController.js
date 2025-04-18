const ReasonService = require('../services/reasonService');
const logger = require('../utils/logger');

class ReasonController {
    static async createReason(req, res) {
        try {
            const { text } = req.body;
            if (!text) {
                logger.warn(`Create reason failed: Missing text, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Reason text is required' });
            }
            const reason = await ReasonService.createItem(text, req.user.userID);
            logger.info(`Reason created by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(201).json(reason);
        } catch (error) {
            logger.error(`Create reason error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to create reason due to an internal error' });
        }
    }

    static async updateReason(req, res) {
        try {
            const { id: reasonID } = req.params;
            const { text } = req.body;
            if (!reasonID || !text) {
                logger.warn(`Update reason failed: Missing reasonID or text, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Reason ID and text are required' });
            }
            const reason = await ReasonService.updateItem(reasonID, text, req.user.userID);
            logger.info(`Reason ${reasonID} updated by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(reason);
        } catch (error) {
            logger.error(`Update reason error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to update reason due to an internal error' });
        }
    }

    static async deleteReason(req, res) {
        try {
            const { id: reasonID } = req.params;
            if (!reasonID) {
                logger.warn(`Delete reason failed: Missing reasonID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Reason ID is required' });
            }
            await ReasonService.deleteItem(reasonID, req.user.userID);
            logger.info(`Reason ${reasonID} deleted by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(204).send();
        } catch (error) {
            logger.error(`Delete reason error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to delete reason due to an internal error' });
        }
    }

    static async getReasonByID(req, res) {
        try {
            const { id: reasonID } = req.params;
            if (!reasonID) {
                logger.warn(`Get reason failed: Missing reasonID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Reason ID is required' });
            }
            const reason = await ReasonService.getItemById(reasonID);
            logger.info(`Fetched reason ${reasonID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(reason);
        } catch (error) {
            logger.error(`Get reason error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to retrieve reason due to an internal error' });
        }
    }

    static async getReasonsByVisitID(req, res) {
        try {
            const { id: visitID } = req.params;
            if (!visitID) {
                logger.warn(`Get reasons by visit failed: Missing visitID, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
                return res.status(400).json({ error: 'Visit ID is required' });
            }
            const reasons = await ReasonService.getReasonsByVisitId(visitID);
            logger.info(`Fetched reasons for visit ${visitID} by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(reasons);
        } catch (error) {
            logger.error(`Get reasons by visit error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to retrieve reasons for visit due to an internal error' });
        }
    }

    static async getAllReasons(req, res) {
        try {
            const reasons = await ReasonService.getAllReasons();
            logger.info(`Fetched all reasons by user ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(200).json(reasons);
        } catch (error) {
            logger.error(`Get all reasons error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`, { ip: req.ip });
            return res.status(500).json({ error: error.message || 'Failed to retrieve all reasons due to an internal error' });
        }
    }
}

module.exports = ReasonController;