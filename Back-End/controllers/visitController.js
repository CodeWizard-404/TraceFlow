const express = require('express');
const router = express.Router();
const VisitService = require('../services/visitService');

// Create a new visit
router.post('/visits', async (req, res) => {
    try {
        const { date, time, location, agentID, supervisorID, timesheetID } = req.body;

        // Validate required fields
        if (!date || !time || !location || !agentID || !supervisorID || !timesheetID) {
            return res.status(400).json({ error: 'Invalid input data' });
        }

        // Call the VisitService to create the visit
        const visit = await VisitService.createVisit({
            date,
            time,
            location,
            agentID,
            supervisorID,
            timesheetID,
        });

        res.status(201).json(visit);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Log details for an existing visit
router.put('/visits/:id/log', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, checklist, photos, comment } = req.body;

        // Validate required fields
        if (!reason || !checklist || !photos || !comment) {
            return res.status(400).json({ error: 'Invalid input data' });
        }

        // Call the VisitService to log the visit
        const visit = await VisitService.logVisit(parseInt(id), {
            reason,
            checklist,
            photos,
            comment,
        });

        res.status(200).json(visit);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;