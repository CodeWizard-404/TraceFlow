const { Visit } = require('../models');
const { Agent } = require('../models');
const { Reason } = require('../models');
const { Checklist } = require('../models');
const ReasonService = require('./reasonService');
const ChecklistService = require('./checklistService');
const { parseTLV } = require('../utils/qrParser');


class VisitService {
    async createVisit(data) {
        try {
            const { date, time, agentID, timesheetID, reasons, checklists } = data;

            // Validate agent exists
            const agent = await Agent.findByPk(agentID);
            if (!agent) throw new Error('Agent not found');
            const location = agent.location;

            // Create visit
            const visit = await Visit.create({
                date, time, location, agentID, timesheetID,
                status: 'pending'
            });

            // Associate reasons using IDs only
            const reasonIds = reasons.map(r => r.id);
            const createdReasons = await ReasonService.getItemsByIds(reasonIds);
            await visit.setReasons(createdReasons);

            // Associate checklist using IDs only
            const checklistIds = checklists.map(c => c.id);
            const createdChecklists = await ChecklistService.getItemsByIds(checklistIds);
            await visit.setChecklists(createdChecklists);

            return visit.reload({ include: [Reason, Checklist] });
        } catch (error) {
            throw new Error('Failed to create visit: ' + error.message);
        }
    }

    async verifyQRCode(qrData, visitId) {
        try {
            console.log('Raw QR Data:', qrData); // Log raw data for debugging
            const parsedQR = parseTLV(qrData);
            console.log('Parsed QR Structure:', JSON.stringify(parsedQR, null, 2));
    
            // Extract phone number with better handling
            let agentPhoneFromQR = parsedQR['29']?.['03'] || parsedQR['02'];
    
            // If it's an object (fallback for malformed data), reconstruct it
            if (typeof agentPhoneFromQR === 'object' && agentPhoneFromQR !== null) {
                agentPhoneFromQR = Object.values(agentPhoneFromQR).join('').replace(/[^0-9+]/g, '');
                console.warn('Phone number was parsed as object, reconstructed as:', agentPhoneFromQR);
            } else {
                agentPhoneFromQR = agentPhoneFromQR?.replace(/[^0-9+]/g, '');
            }
    
            if (!agentPhoneFromQR) {
                throw new Error('Invalid QR code - missing agent phone number');
            }
    
            // Get visit and agent details
            const visit = await Visit.findByPk(visitId);
            const agent = await Agent.findByPk(visit.agentID);
    
            // Compare phone numbers
            if (agent.phone !== agentPhoneFromQR) {
                throw new Error(`Phone mismatch:\nQR: ${agentPhoneFromQR}\nVisit: ${agent.phone}`);
            }
    
            return { valid: true, message: 'Verification successful' };
        } catch (error) {
            console.error('Verification Failed:', error.message);
            return { valid: false, message: error.message };
        }
    }

    async logVisit(visitID, data) {
        try {
            const { duration, checklistUpdates, photos, comment } = data;

            // Find the visit
            const visit = await Visit.findByPk(visitID, { include: [Checklist] });
            if (!visit) throw new Error('Visit not found');

            // Update checklist validation status
            if (checklistUpdates && Array.isArray(checklistUpdates)) {
                for (const update of checklistUpdates) {
                    await ChecklistService.updateChecklistStatus(
                        visitID,
                        update.checklistID,
                        update.checked
                    );
                }
            }

            // Update visit details
            visit.duration = duration;
            visit.photos = photos;
            visit.comment = comment;
            visit.status = 'visited';
            await visit.save();

            return visit.reload({ include: [Checklist] });
        } catch (error) {
            throw new Error('Failed to log visit: ' + error.message);
        }
    }

    async getVisitByID(visitID) {
        try {
            const visit = await Visit.findByPk(visitID);
            if (!visit) throw new Error('Visit not found');
            return visit.reload({ include: [Checklist, Reason] });
        } catch (error) {
            throw new Error('Failed to fetch visit: ' + error.message);
        }
    }
}

module.exports = new VisitService();