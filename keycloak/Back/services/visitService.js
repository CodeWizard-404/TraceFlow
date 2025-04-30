const { Visit, Agent, Reason, Checklist, Timesheet, User } = require('../models');
const { parseTLV } = require('../utils/qrParser');
const ChecklistService = require('./checklistService');
const ReasonService = require('./reasonService');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { sequelize } = require('../config/db');

class VisitService {
    static async createVisit(data, actorID) {
        const { date, time, agentID, supervisorID, timesheetID, reasons, checklists, status = 'pending' } = data;
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
                status,
            });
            if (reasons && reasons.length > 0) {
                const reasonIds = reasons.map((r) => r.id);
                const createdReasons = await ReasonService.getItemsByIds(reasonIds);
                await visit.setReasons(createdReasons);
            }
            if (checklists && checklists.length > 0) {
                const checklistIds = checklists.map((c) => c.id);
                const createdChecklists = await ChecklistService.getItemsByIds(checklistIds);
                await visit.setChecklists(createdChecklists);
            }
            logger.info(`Visit created for agent ${agentID} by user ${actorID}`, { ip: null });
            return visit.reload({ include: [Reason, Checklist] });
        } catch (error) {
            logger.error(`Create visit error: ${error.message}, user: ${actorID}`, { ip: null });
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
            logger.error(`Verify QR code error: ${error.message}, user: ${actorID}`, { ip: null });
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

            // Use new date and time if provided, otherwise keep existing
            const newDate = date || visit.date;
            const newTime = time || visit.time;

            // Calculate weekNumber and year for timesheet assignment
            const newDateObj = new Date(newDate);
            const newYear = newDateObj.getFullYear();
            const newWeekNumber = this.getISOWeekNumber(newDateObj);
            const oldTimesheet = visit.Timesheet;

            // Determine target timesheet
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

            // Handle photo folder (create new folder based on new date and time)
            const oldDate = visit.date;
            const oldTime = visit.time.replace(/:/g, '-');
            const supervisorName = `${visit.Timesheet.User.firstname.toLowerCase()}_${visit.Timesheet.User.lastname.toLowerCase()}`;
            const oldFolderName = `${oldDate}_${oldTime}_${supervisorName}`;
            const oldFolderPath = path.join(__dirname, '../Uploads/photos', oldFolderName);

            const newTimeForFolder = newTime.replace(/:/g, '-');
            const newFolderName = `${newDate}_${newTimeForFolder}_${supervisorName}`;
            const newFolderPath = path.join(__dirname, '../Uploads/photos', newFolderName);

            let photoPaths = visit.photos ? [...visit.photos] : [];

            // Move existing photos to new folder if date or time changed
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
                // Remove old folder if it exists and is empty
                if (fs.existsSync(oldFolderPath) && fs.readdirSync(oldFolderPath).length === 0) {
                    fs.rmSync(oldFolderPath, { recursive: true, force: true });
                }
            }

            // Save new photos to the new folder
            if (!fs.existsSync(newFolderPath)) {
                fs.mkdirSync(newFolderPath, { recursive: true });
            }
            const newPhotoPaths = files.map((file) => {
                const destPath = path.join(newFolderPath, file.filename);
                fs.renameSync(file.path, destPath);
                return `/uploads/photos/${newFolderName}/${file.filename}`;
            });
            photoPaths = [...photoPaths, ...newPhotoPaths];

            // Parse checklistUpdates if it’s a string
            let parsedChecklistUpdates = checklistUpdates;
            if (typeof checklistUpdates === 'string') {
                try {
                    parsedChecklistUpdates = JSON.parse(checklistUpdates);
                } catch (e) {
                    logger.error(`Parse checklistUpdates error: ${e.message}, user: ${actorID}`, { ip: null });
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

            // Update visit fields
            visit.date = newDate;
            visit.time = newTime;
            visit.duration = duration || visit.duration;
            visit.photos = photoPaths;
            visit.comment = comment || visit.comment;
            visit.status = 'visited';
            await visit.save({ transaction });

            // Reload visit with associations before committing transaction
            const reloadedVisit = await Visit.findByPk(visitID, {
                include: [Checklist],
                transaction,
            });

            await transaction.commit();
            return reloadedVisit;
        } catch (error) {
            await transaction.rollback();
            logger.error(`Log visit error: ${error.message}, user: ${actorID}`, { ip: null });
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

            // Parse photosToRemove if it’s a string
            let photosArray = photosToRemove;
            if (typeof photosToRemove === 'string') {
                try {
                    photosArray = JSON.parse(photosToRemove);
                } catch (e) {
                    logger.error(`Parse photosToRemove error: ${e.message}, user: ${actorID}`, { ip: null });
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

            // Add new photos to the existing folder
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

            // Calculate weekNumber and year from the visit's date
            const newDate = date || visit.date;
            const newDateObj = new Date(newDate);
            const newYear = newDateObj.getFullYear();
            const newWeekNumber = this.getISOWeekNumber(newDateObj);
            const oldTimesheet = visit.Timesheet;

            // Handle supervisor change
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

            // Update agent if changed
            if (agentID && agentID !== visit.agentID) {
                const agent = await Agent.findByPk(agentID);
                if (!agent) {
                    const error = new Error('Agent not found');
                    error.status = 404;
                    throw error;
                }
                visit.agentID = agentID;
                visit.location = agent.location;
            }

            // Parse checklists and reasons
            let parsedChecklists = checklists;
            if (typeof checklists === 'string') {
                try {
                    parsedChecklists = JSON.parse(checklists);
                } catch (e) {
                    logger.error(`Parse checklists error: ${e.message}, user: ${actorID}`, { ip: null });
                    parsedChecklists = [];
                }
            }
            let parsedReasons = reasons;
            if (typeof reasons === 'string') {
                try {
                    parsedReasons = JSON.parse(reasons);
                } catch (e) {
                    logger.error(`Parse reasons error: ${e.message}, user: ${actorID}`, { ip: null });
                    parsedReasons = [];
                }
            }

            // Update checklists
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

            // Update reasons
            if (parsedReasons && Array.isArray(parsedReasons)) {
                const reasonIds = parsedReasons.map((r) => r.id);
                const updatedReasons = await ReasonService.getItemsByIds(reasonIds);
                await visit.setReasons(updatedReasons);
            }

            // Update visit fields
            visit.date = newDate;
            visit.time = time || visit.time;
            visit.duration = duration !== undefined ? duration : visit.duration;
            visit.location = location || visit.location;
            visit.status = status || visit.status;
            visit.photos = photoPaths;
            visit.comment = comment !== undefined ? comment : visit.comment;

            await visit.save();
            return visit.reload({ include: [Checklist, Reason] });
        } catch (error) {
            logger.error(`Update visit error: ${error.message}, user: ${actorID}`, { ip: null });
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
            await visit.destroy();
            return { message: 'Visit and associated photos deleted successfully' };
        } catch (error) {
            logger.error(`Delete visit error: ${error.message}, user: ${actorID}`, { ip: null });
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
            logger.error(`Get visit error: ${error.message}`, { ip: null });
            const err = new Error('Failed to fetch visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }
}

module.exports = VisitService;