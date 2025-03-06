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
            const { date, time, agentID, timesheetID, reasons, checklist } = data;

            // Validate agent exists
            const agent = await Agent.findByPk(agentID);
            if (!agent) throw new Error('Agent not found');
            const location = agent.location;

            // Create visit
            const visit = await Visit.create({
                date, time, location, agentID, timesheetID,
                status: 'pending'
            });

            // Associate reasons
            const createdReasons = await ReasonService.findOrCreateItems(reasons);
            await visit.setReasons(createdReasons);

            // Associate checklist items
            const createdChecklists = await ChecklistService.findOrCreateItems(checklist);
            await visit.setChecklists(createdChecklists);

            return visit.reload({ include: [Reason, Checklist] });
        } catch (error) {
            throw new Error('Failed to create visit: ' + error.message);
        }
    }

    async verifyQRCode(qrData, visitId) {
        try {
            const parsedQR = parseTLV(qrData);
            console.log('Parsed QR Structure:', JSON.stringify(parsedQR, null, 2)); // Pretty-print parsed data

            // Correct phone number extraction path
            const agentPhoneFromQR = parsedQR['29']?.['03']
                || parsedQR['02']?.replace(/[^0-9+]/g, ''); // Fallback for simple values

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
            for (const checklist of visit.Checklists) {
                const updatedStatus = checklistUpdates[checklist.checklistID];
                if (updatedStatus !== undefined) {
                    await ChecklistService.updateChecklistStatus(
                        visitID,
                        checklist.checklistID,
                        updatedStatus
                    );
                }
            }

                // Update the visit details
                visit.duration = duration;
                visit.photos = photos;
                visit.comment = comment;
                visit.status = 'visited';
                await visit.save();
                return visit.reload({ include: [Checklist, Reason] });

            } catch (error) {
                throw new Error('Failed to log visit: ' + error.message);
            }
        }

    async getVisitByID(visitID) {
            try {
                const visit = await Visit.findByPk(visitID);
                if (!visit) throw new Error('Visit not found');
                return visit;
            } catch (error) {
                throw new Error('Failed to fetch visit: ' + error.message);
            }
        }
    }

module.exports = new VisitService();