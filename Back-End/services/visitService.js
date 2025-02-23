// services/visitService.js
const { Visit } = require('../models');
const { Agent } = require('../models');

class VisitService {
    async createVisit(data) {
        try {
            const { date, time, agentID, supervisorID, timesheetID } = data;
            // Validate agent exists
            const agent = await Agent.findByPk(agentID);
            if (!agent) throw new Error('Agent not found');
            const location = agent.location;
            // Create the visit with pending status
            const visit = await Visit.create({
                date,
                time,
                location,
                agentID,
                supervisorID,
                timesheetID,
                status: 'pending',
            });
            return visit;
        } catch (error) {
            throw new Error('Failed to create visit: ' + error.message);
        }
    }

    async logVisit(visitID, data) {
        try {
            const { duration, reason, checklist, photos, comment } = data;
            // Find the visit
            const visit = await Visit.findByPk(visitID);
            if (!visit) throw new Error('Visit not found');
            // Update the visit details
            visit.duration = duration;
            visit.reason = reason;
            visit.checklist = checklist;
            visit.photos = photos;
            visit.comment = comment;
            visit.status = 'visited';
            await visit.save();
            return visit;
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