const { Visit, Agent, Reason, Checklist, Timesheet, User } = require('../models');
const { parseTLV } = require('../utils/qrParser');
const ChecklistService = require('./checklistService');
const ReasonService = require('./reasonService');
const GoogleCalendarService = require('./googleCalendarService');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('../config/db');
const logger = require('../utils/logger');

class VisitService {
    static async createVisit(data, actorID, options = {}) {
        const { date, time, agentID, supervisorID, timesheetID, reasons, checklists, location, status = 'pending' } = data;

        // Validate required fields
        if (!date || !time || !supervisorID) {
            const error = new Error('Missing required fields');
            error.status = 400;
            throw error;
        }

        const transaction = options.transaction || await sequelize.transaction();
        let isLocalTransaction = !options.transaction;

        try {
            // Calculate week number and year from date
            const dateObj = new Date(date);
            const year = dateObj.getFullYear();
            const weekNumber = this.getISOWeekNumber(dateObj);

            // Check for existing timesheet
            let targetTimesheet;
            if (timesheetID) {
                targetTimesheet = await Timesheet.findByPk(timesheetID, { transaction });
                if (!targetTimesheet) {
                    const error = new Error('Specified timesheet not found');
                    error.status = 404;
                    throw error;
                }
                logger.info(`Using provided timesheet ${targetTimesheet.timesheetID} for visit creation`);
            } else {
                targetTimesheet = await Timesheet.findOne({
                    where: {
                        weekNumber,
                        year,
                        supervisorID,
                    },
                    include: [{ model: Visit }],
                    transaction,
                });

                if (!targetTimesheet) {
                    try {
                        targetTimesheet = await Timesheet.create(
                            {
                                weekNumber,
                                year,
                                supervisorID,
                                status: status,
                            },
                            { transaction }
                        );
                        logger.info(`Created new timesheet ${targetTimesheet.timesheetID} for week ${weekNumber}, year ${year}, supervisor ${supervisorID}`);
                    } catch (error) {
                        if (error.name === 'SequelizeUniqueConstraintError') {
                            // Retry to find the timesheet
                            targetTimesheet = await Timesheet.findOne({
                                where: { weekNumber, year, supervisorID },
                                include: [{ model: Visit }],
                                transaction,
                            });
                            if (!targetTimesheet) {
                                throw new Error('Failed to find or create timesheet after unique constraint error');
                            }
                            logger.info(`Reused timesheet ${targetTimesheet.timesheetID} after unique constraint retry for week ${weekNumber}, year ${year}, supervisor ${supervisorID}`);
                        } else {
                            throw error;
                        }
                    }
                } else {
                    logger.info(`Reused existing timesheet ${targetTimesheet.timesheetID} for week ${weekNumber}, year ${year}, supervisor ${supervisorID}`);
                }
            }

            // Fetch agent if agentID is provided
            let visitLocation = location;
            if (agentID) {
                const agent = await Agent.findByPk(agentID, { transaction });
                if (!agent) {
                    const error = new Error('Agent not found');
                    error.status = 404;
                    throw error;
                }
                visitLocation = visitLocation || agent.location;
            }

            // Create the visit
            const visit = await Visit.create(
                {
                    date,
                    time,
                    location: visitLocation,
                    agentID,
                    timesheetID: targetTimesheet.timesheetID,
                    status,
                },
                { transaction }
            );

            // Attach reasons
            if (reasons && Array.isArray(reasons) && reasons.length > 0) {
                try {
                    const reasonIds = reasons.map((r) => r.id).filter((id) => id);
                    if (reasonIds.length > 0) {
                        const createdReasons = await ReasonService.getItemsByIds(reasonIds, { transaction });
                        if (createdReasons.length > 0) {
                            await visit.setReasons(createdReasons, { transaction });
                        } else {
                            logger.warn(`No valid reasons found for visit ${visit.visitID}`);
                        }
                    }
                } catch (error) {
                    logger.warn(`Failed to attach reasons to visit ${visit.visitID}: ${error.message}`);
                }
            }

            // Attach checklists
            if (checklists && Array.isArray(checklists) && checklists.length > 0) {
                try {
                    const checklistIds = checklists.map((c) => c.id).filter((id) => id);
                    if (checklistIds.length > 0) {
                        const createdChecklists = await ChecklistService.getItemsByIds(checklistIds, { transaction });
                        if (createdChecklists.length > 0) {
                            await visit.setChecklists(createdChecklists, { transaction });
                        } else {
                            logger.warn(`No valid checklists found for visit ${visit.visitID}`);
                        }
                    }
                } catch (error) {
                    logger.warn(`Failed to attach checklists to visit ${visit.visitID}: ${error.message}`);
                }
            }

            // Update timesheet status based on all visits
            const timesheetWithVisits = await Timesheet.findByPk(targetTimesheet.timesheetID, {
                include: [{ model: Visit }],
                transaction,
            });

            // Include the new visit's status in the status check
            const visitStatuses = [
                ...timesheetWithVisits.Visits.map((v) => v.status),
                status, // Include the newly created visit's status
            ];
            const uniqueStatuses = [...new Set(visitStatuses)];

            if (uniqueStatuses.length > 1) {
                // If visits have different statuses, set timesheet to 'pending'
                timesheetWithVisits.status = 'pending';
            } else {
                // If all visits have the same status, set timesheet to that status
                timesheetWithVisits.status = uniqueStatuses[0];
            }
            await timesheetWithVisits.save({ transaction });

            // Reload visit with associations
            const reloadedVisit = await visit.reload({ include: [Reason, Checklist], transaction });

            // Google Calendar sync
            try {
                const event = await GoogleCalendarService.createCalendarEvent(supervisorID, visit.visitID);
                await GoogleCalendarService.notifyCalendarUpdate(supervisorID, {
                    visitId: visit.visitID,
                    calendarEventId: event.id,
                    action: 'created',
                });
            } catch (error) {
                logger.warn(`Failed to sync visit ${visit.visitID} to calendar: ${error.message}`);
            }

            if (isLocalTransaction) await transaction.commit();
            return reloadedVisit;
        } catch (error) {
            if (isLocalTransaction) await transaction.rollback();
            const err = new Error('Failed to create visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async verifyQRCode(qrData, visitId, actorID) {
        if (!qrData || !visitId) {
            const error = new Error('Missing required parameters');
            error.status = 400;
            throw error;
        }
        try {
            const visit = await Visit.findByPk(visitId);
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            // Skip QR verification for visits without an agent (e.g., recruitment visits)
            if (!visit.agentID) {
                return { valid: true, message: 'Verification skipped for recruitment visit' };
            }
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

    static async logVisit(visitID, data, files, actorID) {
        const transaction = await sequelize.transaction();
        try {
            const { duration, checklistUpdates, comment, date, time } = data;
            if (!files || files.length === 0) {
                const error = new Error('At least one photo is required to log a visit');
                error.status = 400;
                throw error;
            }

            const visit = await Visit.findByPk(visitID, {
                include: [{ model: Timesheet, include: [User] }],
                transaction,
            });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }

            const newDate = date || visit.date;
            const newTime = time || visit.time;

            const newDateObj = new Date(newDate);
            const newYear = newDateObj.getFullYear();
            const newWeekNumber = this.getISOWeekNumber(newDateObj);
            const oldTimesheet = visit.Timesheet;

            let targetTimesheet = oldTimesheet;
            if (newWeekNumber !== oldTimesheet.weekNumber || newYear !== oldTimesheet.year) {
                targetTimesheet = await Timesheet.findOne({
                    where: {
                        weekNumber: newWeekNumber,
                        year: newYear,
                        supervisorID: oldTimesheet.supervisorID,
                    },
                    transaction,
                });
                if (!targetTimesheet) {
                    targetTimesheet = await Timesheet.create(
                        {
                            weekNumber: newWeekNumber,
                            year: newYear,
                            supervisorID: oldTimesheet.supervisorID,
                            status: 'pending',
                        },
                        { transaction }
                    );
                }
                visit.timesheetID = targetTimesheet.timesheetID;
            }

            const oldDate = visit.date;
            const oldTime = visit.time.replace(/:/g, '-');
            const supervisorName = `${visit.Timesheet.User.firstname.toLowerCase()}_${visit.Timesheet.User.lastname.toLowerCase()}`;
            const oldFolderName = `${oldDate}_${oldTime}_${supervisorName}`;
            const oldFolderPath = path.join(__dirname, '../Uploads/photos', oldFolderName);

            const newTimeForFolder = newTime.replace(/:/g, '-');
            const newFolderName = `${newDate}_${newTimeForFolder}_${supervisorName}`;
            const newFolderPath = path.join(__dirname, '../Uploads/photos', newFolderName);

            let photoPaths = visit.photos ? [...visit.photos] : [];

            if (newDate !== oldDate || newTime !== visit.time) {
                if (!fs.existsSync(newFolderPath)) {
                    fs.mkdirSync(newFolderPath, { recursive: true });
                }
                if (photoPaths.length > 0) {
                    const updatedPhotoPaths = [];
                    for (const photo of photoPaths) {
                        const oldPhotoPath = path.join(__dirname, '..', photo);
                        const filename = path.basename(photo);
                        const newPhotoPath = path.join(newFolderPath, filename);
                        if (fs.existsSync(oldPhotoPath)) {
                            fs.renameSync(oldPhotoPath, newPhotoPath);
                        }
                        updatedPhotoPaths.push(`/uploads/photos/${newFolderName}/${filename}`);
                    }
                    photoPaths = updatedPhotoPaths;
                }
                if (fs.existsSync(oldFolderPath) && fs.readdirSync(oldFolderPath).length === 0) {
                    fs.rmSync(oldFolderPath, { recursive: true, force: true });
                }
            }

            if (!fs.existsSync(newFolderPath)) {
                fs.mkdirSync(newFolderPath, { recursive: true });
            }
            const newPhotoPaths = files.map((file) => {
                const destPath = path.join(newFolderPath, file.filename);
                fs.renameSync(file.path, destPath);
                return `/uploads/photos/${newFolderName}/${file.filename}`;
            });
            photoPaths = [...photoPaths, ...newPhotoPaths];

            let parsedChecklistUpdates = checklistUpdates;
            if (typeof checklistUpdates === 'string') {
                try {
                    parsedChecklistUpdates = JSON.parse(checklistUpdates);
                } catch (e) {
                    const error = new Error('Invalid checklistUpdates format');
                    error.status = 400;
                    throw error;
                }
            }

            if (parsedChecklistUpdates && Array.isArray(parsedChecklistUpdates)) {
                for (const update of parsedChecklistUpdates) {
                    await ChecklistService.updateChecklistStatus(visitID, update.checklistID, update.checked, { transaction });
                }
            }

            visit.date = newDate;
            visit.time = newTime;
            visit.duration = duration || visit.duration;
            visit.photos = photoPaths;
            visit.comment = comment || visit.comment;
            visit.status = 'visited';
            await visit.save({ transaction });

            const reloadedVisit = await Visit.findByPk(visitID, {
                include: [Checklist],
                transaction,
            });

            // Update Google Calendar event
            try {
                const event = await GoogleCalendarService.updateCalendarEvent(visit.Timesheet.supervisorID, visitID);
                await GoogleCalendarService.notifyCalendarUpdate(visit.Timesheet.supervisorID, {
                    visitId: visitID,
                    calendarEventId: event.id,
                    action: 'updated',
                });
            } catch (error) {
                logger.warn(`Failed to update calendar event for visit ${visitID} during logging: ${error.message}`);
            }

            await transaction.commit();
            return reloadedVisit;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async updateVisit(visitID, data, files = [], actorID) {
        try {
            const { date, time, duration, location, status, comment, agentID, checklists, reasons, photosToRemove, supervisorID } = data;

            const visit = await Visit.findByPk(visitID, {
                include: [{ model: Timesheet, include: [User] }, Checklist, Reason],
            });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }

            const oldDate = visit.date;
            const oldTime = visit.time.replace(/:/g, '-');
            const supervisorName = `${visit.Timesheet.User.firstname.toLowerCase()}_${visit.Timesheet.User.lastname.toLowerCase()}`;
            const folderName = `${oldDate}_${oldTime}_${supervisorName}`;
            const folderPath = path.join(__dirname, '../Uploads/photos', folderName);

            let photoPaths = visit.photos ? [...visit.photos] : [];

            let photosArray = photosToRemove;
            if (typeof photosToRemove === 'string') {
                try {
                    photosArray = JSON.parse(photosToRemove);
                } catch (e) {
                    photosArray = [];
                }
            }

            if (photosArray && Array.isArray(photosArray) && photosArray.length > 0) {
                photoPaths = photoPaths.filter((p) => !photosArray.includes(p));
                photosArray.forEach((photo) => {
                    const photoPath = path.join(__dirname, '..', photo);
                    if (fs.existsSync(photoPath)) {
                        fs.unlinkSync(photoPath);
                    }
                });
            }

            if (files && files.length > 0) {
                if (!fs.existsSync(folderPath)) {
                    fs.mkdirSync(folderPath, { recursive: true });
                }
                files.forEach((file) => {
                    const destPath = path.join(folderPath, file.filename);
                    fs.renameSync(file.path, destPath);
                    const newPhotoPath = `/uploads/photos/${folderName}/${file.filename}`;
                    photoPaths.push(newPhotoPath);
                });
            }

            const newDate = date || visit.date;
            const newDateObj = new Date(newDate);
            const newYear = newDateObj.getFullYear();
            const newWeekNumber = this.getISOWeekNumber(newDateObj);
            const oldTimesheet = visit.Timesheet;

            let targetTimesheet = oldTimesheet;
            if (supervisorID && supervisorID !== oldTimesheet.supervisorID) {
                targetTimesheet = await Timesheet.findOne({
                    where: {
                        weekNumber: newWeekNumber,
                        year: newYear,
                        supervisorID: supervisorID,
                    },
                });
                if (!targetTimesheet) {
                    targetTimesheet = await Timesheet.create({
                        weekNumber: newWeekNumber,
                        year: newYear,
                        supervisorID: supervisorID,
                        status: 'pending',
                    });
                }
                visit.timesheetID = targetTimesheet.timesheetID;
            } else if (newWeekNumber !== oldTimesheet.weekNumber || newYear !== oldTimesheet.year) {
                targetTimesheet = await Timesheet.findOne({
                    where: {
                        weekNumber: newWeekNumber,
                        year: newYear,
                        supervisorID: oldTimesheet.supervisorID,
                    },
                });
                if (!targetTimesheet) {
                    targetTimesheet = await Timesheet.create({
                        weekNumber: newWeekNumber,
                        year: newYear,
                        supervisorID: oldTimesheet.supervisorID,
                        status: 'pending',
                    });
                }
                visit.timesheetID = targetTimesheet.timesheetID;
            }

            if (agentID !== undefined) { // Allow agentID to be set to null
                if (agentID) {
                    const agent = await Agent.findByPk(agentID);
                    if (!agent) {
                        const error = new Error('Agent not found');
                        error.status = 404;
                        throw error;
                    }
                    visit.agentID = agentID;
                    visit.location = location || agent.location; // Use provided location or agent location
                } else {
                    visit.agentID = null;
                    visit.location = location; // Use provided location or null
                }
            } else {
                visit.location = location !== undefined ? location : visit.location;
            }

            let parsedChecklists = checklists;
            if (typeof checklists === 'string') {
                try {
                    parsedChecklists = JSON.parse(checklists);
                } catch (e) {
                    parsedChecklists = [];
                }
            }
            let parsedReasons = reasons;
            if (typeof reasons === 'string') {
                try {
                    parsedReasons = JSON.parse(reasons);
                } catch (e) {
                    parsedReasons = [];
                }
            }

            if (parsedChecklists && Array.isArray(parsedChecklists)) {
                const checklistIds = parsedChecklists.map((c) => c.id);
                const updatedChecklists = await ChecklistService.getItemsByIds(checklistIds);
                await visit.setChecklists(updatedChecklists);
                for (const checklist of parsedChecklists) {
                    if (checklist.checked !== undefined) {
                        await ChecklistService.updateChecklistStatus(visitID, checklist.id, checklist.checked);
                    }
                }
            }

            if (parsedReasons && Array.isArray(parsedReasons)) {
                const reasonIds = parsedReasons.map((r) => r.id);
                const updatedReasons = await ReasonService.getItemsByIds(reasonIds);
                await visit.setReasons(updatedReasons);
            }

            visit.date = newDate;
            visit.time = time || visit.time;
            visit.duration = duration !== undefined ? duration : visit.duration;
            visit.status = status || visit.status;
            visit.photos = photoPaths;
            visit.comment = comment !== undefined ? comment : visit.comment;

            await visit.save();

            // Update Google Calendar event
            try {
                const event = await GoogleCalendarService.updateCalendarEvent(visit.Timesheet.supervisorID, visitID);
                await GoogleCalendarService.notifyCalendarUpdate(visit.Timesheet.supervisorID, {
                    visitId: visitID,
                    calendarEventId: event.id,
                    action: 'updated',
                });
            } catch (error) {
                logger.warn(`Failed to update calendar event for visit ${visitID}: ${error.message}`);
            }

            return visit.reload({ include: [Checklist, Reason] });
        } catch (error) {
            const err = new Error('Failed to update visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static getISOWeekNumber(date) {
        const tempDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
        const weekNumber = Math.ceil(((tempDate - yearStart) / 86400000 + 1) / 7);
        return weekNumber;
    }

    static async deleteVisit(visitID, actorID) {
        try {
            const visit = await Visit.findByPk(visitID, {
                include: [{ model: Timesheet, include: [User] }],
            });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            const date = visit.date;
            const time = visit.time.replace(/:/g, '-');
            const supervisorName = `${visit.Timesheet.User.firstname.toLowerCase()}_${visit.Timesheet.User.lastname.toLowerCase()}`;
            const folderName = `${date}_${time}_${supervisorName}`;
            const folderPath = path.join(__dirname, '../Uploads/photos', folderName);

            if (fs.existsSync(folderPath)) {
                fs.rmSync(folderPath, { recursive: true, force: true });
            }

            // Delete Google Calendar event
            try {
                await GoogleCalendarService.deleteCalendarEvent(visit.Timesheet.supervisorID, visitID);
                await GoogleCalendarService.notifyCalendarUpdate(visit.Timesheet.supervisorID, {
                    visitId: visitID,
                    action: 'deleted',
                });
            } catch (error) {
                logger.warn(`Failed to delete calendar event for visit ${visitID}: ${error.message}`);
            }

            await visit.destroy();
            return { message: 'Visit and associated photos deleted successfully' };
        } catch (error) {
            const err = new Error('Failed to delete visit: ' + error.message);
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