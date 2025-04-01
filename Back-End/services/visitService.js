const { Visit, Agent, Reason, Checklist, Timesheet, User } = require('../models');
const { parseTLV } = require('../utils/qrParser');
const ChecklistService = require('./checklistService');
const ReasonService = require('./reasonService');
const path = require('path');
const fs = require('fs');

class VisitService {
    static async createVisit(data) {
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
                const reasonIds = reasons.map(r => r.id);
                const createdReasons = await ReasonService.getItemsByIds(reasonIds);
                await visit.setReasons(createdReasons);
            }
            if (checklists && checklists.length > 0) {
                const checklistIds = checklists.map(c => c.id);
                const createdChecklists = await ChecklistService.getItemsByIds(checklistIds);
                await visit.setChecklists(createdChecklists);
            }
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

    static async logVisit(visitID, data, files) {
        try {
            const { duration, checklistUpdates, comment } = data;
            if (!files || files.length === 0) {
                const error = new Error('At least one photo is required to log a visit');
                error.status = 400;
                throw error;
            }

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
            const folderPath = path.join(__dirname, '../uploads/photos', folderName);
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
            const photoPaths = files.map(file => `/uploads/photos/${folderName}/${file.filename}`);

            // Parse checklistUpdates if it’s a string
            let parsedChecklistUpdates = checklistUpdates;
            if (typeof checklistUpdates === 'string') {
                try {
                    parsedChecklistUpdates = JSON.parse(checklistUpdates);
                } catch (e) {
                    console.error('Failed to parse checklistUpdates:', checklistUpdates, e);
                    const error = new Error('Invalid checklistUpdates format');
                    error.status = 400;
                    throw error;
                }
            }

            if (parsedChecklistUpdates && Array.isArray(parsedChecklistUpdates)) {
                for (const update of parsedChecklistUpdates) {
                    await ChecklistService.updateChecklistStatus(visitID, update.checklistID, update.checked);
                }
            }

            visit.duration = duration || visit.duration;
            visit.photos = photoPaths;
            visit.comment = comment || visit.comment;
            visit.status = 'visited';
            await visit.save();
            return visit.reload({ include: [Checklist] });
        } catch (error) {
            console.error(`${new Date().toISOString()} - Log visit failed:`, error);
            throw error;
        }
    }

    static async updateVisit(visitID, data, files = []) {
        try {
            const {
                date,
                time,
                duration,
                location,
                status,
                comment,
                agentID,
                checklists,
                reasons,
                photosToRemove,
                supervisorID
            } = data;

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
            const folderPath = path.join(__dirname, '../uploads/photos', folderName);

            // Log initial state
            console.log('Initial visit.photos:', visit.photos);

            // Handle photos
            let photoPaths = visit.photos ? [...visit.photos] : [];

            // Parse photosToRemove if it’s a string
            let photosArray = photosToRemove;
            if (typeof photosToRemove === 'string') {
                try {
                    photosArray = JSON.parse(photosToRemove);
                } catch (e) {
                    console.error('Failed to parse photosToRemove:', photosToRemove, e);
                    photosArray = [];
                }
            }

            if (photosArray && Array.isArray(photosArray) && photosArray.length > 0) {
                console.log('Photos to remove:', photosArray);
                photoPaths = photoPaths.filter(p => !photosArray.includes(p));
                photosArray.forEach(photo => {
                    const photoPath = path.join(__dirname, '..', photo);
                    if (fs.existsSync(photoPath)) {
                        fs.unlinkSync(photoPath);
                        console.log(`Deleted photo from filesystem: ${photo}`);
                    } else {
                        console.log(`Photo not found in filesystem: ${photo}`);
                    }
                });
            }
            console.log('After removal, photoPaths:', photoPaths);

            // Add new photos to the existing folder
            if (files && files.length > 0) {
                if (!fs.existsSync(folderPath)) {
                    fs.mkdirSync(folderPath, { recursive: true });
                }
                files.forEach(file => {
                    const destPath = path.join(folderPath, file.filename);
                    fs.renameSync(file.path, destPath);
                    const newPhotoPath = `/uploads/photos/${folderName}/${file.filename}`;
                    photoPaths.push(newPhotoPath);
                    console.log(`Added new photo: ${newPhotoPath}`);
                });
            }
            console.log('After adding new photos, photoPaths:', photoPaths);

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
                parsedChecklists = JSON.parse(checklists);
            }
            let parsedReasons = reasons;
            if (typeof reasons === 'string') {
                parsedReasons = JSON.parse(reasons);
            }

            // Update checklists
            if (parsedChecklists && Array.isArray(parsedChecklists)) {
                const checklistIds = parsedChecklists.map(c => c.id);
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
                const reasonIds = parsedReasons.map(r => r.id);
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

            console.log('Before save, visit.photos:', visit.photos);

            await visit.save();

            console.log('After save, visit.photos:', visit.photos);

            return visit.reload({ include: [Checklist, Reason] });
        } catch (error) {
            console.error('Failed to update visit:', error);
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

    static async deleteVisit(visitID) {
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
            const folderPath = path.join(__dirname, '../uploads/photos', folderName);

            if (fs.existsSync(folderPath)) {
                fs.rmSync(folderPath, { recursive: true, force: true });
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