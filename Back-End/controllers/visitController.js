const Visit = require('../models/visit');

exports.logVisit = async (req, res) => {
    try {
        const { date, time, location, reason, checklist, photos, agentID, supervisorID } = req.body;
        const visit = await Visit.create({ date, time, location, reason, checklist, photos, agentID, supervisorID });
        res.status(201).json({ message: 'Visit logged successfully', visit });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.validateChecklist = async (req, res) => {
    try {
        const { visitID } = req.params;
        const visit = await Visit.findByPk(visitID);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });

        visit.checklist = req.body.checklist;
        await visit.save();
        res.status(200).json({ message: 'Checklist validated successfully', visit });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};