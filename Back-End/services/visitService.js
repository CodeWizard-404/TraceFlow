const Visit = require('../models/visit');
const Agent = require('../models/Agent');

class VisitService {
    async logVisit(data) {
        try {
            const { date, time, location, reason, checklist, photos, agentID, supervisorID } = data;

            // Validate agent exists
            const agent = await Agent.findByPk(agentID);
            if (!agent) throw new Error('Agent not found');

            // Create the visit
            const visit = await Visit.create({
                date,
                time,
                location,
                reason,
                checklist,
                photos,
                agentID,
                supervisorID,
            });

            return visit;
        } catch (error) {
            throw new Error('Failed to log visit: ' + error.message);
        }
    }

    async validateChecklist(visitID, checklist) {
        try {
            const visit = await Visit.findByPk(visitID);
            if (!visit) throw new Error('Visit not found');

            visit.checklist = checklist;
            await visit.save();
            return visit;
        } catch (error) {
            throw new Error('Failed to validate checklist: ' + error.message);
        }
    }
}

module.exports = new VisitService();