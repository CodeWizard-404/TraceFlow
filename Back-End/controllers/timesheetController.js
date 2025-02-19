const Timesheet = require('../models/timesheet');

exports.createTimesheet = async (req, res) => {
    try {
        const { weekNumber, year, supervisorID } = req.body;
        const timesheet = await Timesheet.create({ weekNumber, year, supervisorID });
        res.status(201).json({ message: 'Timesheet created successfully', timesheet });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.viewTimesheet = async (req, res) => {
    try {
        const { timesheetID } = req.params;
        const timesheet = await Timesheet.findByPk(timesheetID);
        if (!timesheet) return res.status(404).json({ error: 'Timesheet not found' });

        res.status(200).json({ timesheet });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.validateTimesheet = async (req, res) => {
    try {
        const { timesheetID } = req.params;
        const timesheet = await Timesheet.findByPk(timesheetID);
        if (!timesheet) return res.status(404).json({ error: 'Timesheet not found' });

        timesheet.status = 'validated';
        await timesheet.save();
        res.status(200).json({ message: 'Timesheet validated successfully', timesheet });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};