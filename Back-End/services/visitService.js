const { Visit, Agent, Reason, Checklist } = require('../models');
const { parseTLV } = require('../utils/qrParser');
const ChecklistService = require('./checklistService');
const ReasonService = require('./reasonService');

class VisitService {
    static async createVisit(data) {
        const { date, time, agentID, supervisorID, timesheetID, reasons, checklists } = data;
        if (!date || !time || !agentID || !supervisorID || !timesheetID) {
            const error = new Error('Missing required fields');
            error.status = 400;
            throw error;
        }
        try {
            const agent = await Agent.findByPk(agentID);
            if (!agent) {
                const error = new Error('Agent not found');
                error.status = 404;
                throw error;
            }
            const visit = await Visit.create({
                date,
                time,
                location: agent.location,
                agentID,
                timesheetID,
                status: 'pending',
            });
            const reasonIds = reasons.map(r => r.id);
            const createdReasons = await ReasonService.getItemsByIds(reasonIds);
            await visit.setReasons(createdReasons);
            const checklistIds = checklists.map(c => c.id);
            const createdChecklists = await ChecklistService.getItemsByIds(checklistIds);
            await visit.setChecklists(createdChecklists);
            return visit.reload({ include: [Reason, Checklist] });
        } catch (error) {
            const err = new Error('Failed to create visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async verifyQRCode(qrData, visitId) {
        if (!qrData || !visitId) {
            const error = new Error('Missing required parameters');
            error.status = 400;
            throw error;
        }
        try {
            const parsedQR = parseTLV(qrData);
            let agentPhoneFromQR = parsedQR['29']?.['03'] || parsedQR['02'];
            if (typeof agentPhoneFromQR === 'object' && agentPhoneFromQR !== null) {
                agentPhoneFromQR = Object.values(agentPhoneFromQR).join('').replace(/[^0-9+]/g, '');
            } else {
                agentPhoneFromQR = agentPhoneFromQR?.replace(/[^0-9+]/g, '');
            }
            if (!agentPhoneFromQR) {
                const error = new Error('Invalid QR code - missing agent phone number');
                error.status = 400;
                throw error;
            }
            const visit = await Visit.findByPk(visitId);
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            const agent = await Agent.findByPk(visit.agentID);
            if (agent.phone !== agentPhoneFromQR) {
                const error = new Error(`Phone mismatch:\nQR: ${agentPhoneFromQR}\nVisit: ${agent.phone}`);
                error.status = 400;
                throw error;
            }
            return { valid: true, message: 'Verification successful' };
        } catch (error) {
            const err = new Error(error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async logVisit(visitID, data) {
        try {
            const { duration, checklistUpdates, photos, comment } = data;
            const visit = await Visit.findByPk(visitID, { include: [Checklist] });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            if (checklistUpdates && Array.isArray(checklistUpdates)) {
                for (const update of checklistUpdates) {
                    await ChecklistService.updateChecklistStatus(visitID, update.checklistID, update.checked);
                }
            }
            visit.duration = duration;
            visit.photos = photos;
            visit.comment = comment;
            visit.status = 'visited';
            await visit.save();
            return visit.reload({ include: [Checklist] });
        } catch (error) {
            const err = new Error('Failed to log visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async getVisitByID(visitID) {
        try {
            const visit = await Visit.findByPk(visitID, { include: [Checklist, Reason] });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            return visit;
        } catch (error) {
            const err = new Error('Failed to fetch visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }
}

module.exports = VisitService;