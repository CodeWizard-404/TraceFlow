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
            const reasonIds = reasons.map(r => r.id);
            const createdReasons = await ReasonService.getItemsByIds(reasonIds);
            await visit.setReasons(createdReasons);
            const checklistIds = checklists.map(c => c.id);
            const createdChecklists = await ChecklistService.getItemsByIds(checklistIds);
            await visit.setChecklists(createdChecklists);
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
            const supervisorName = visit.Timesheet.User.firstname.toLowerCase();
            const folderName = `${date}_${time}_${supervisorName}`;
            const photoPaths = files.map(file => `/uploads/photos/${folderName}/${file.filename}`);

            if (checklistUpdates && Array.isArray(checklistUpdates)) {
                for (const update of checklistUpdates) {
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
            const err = new Error('Failed to log visit: ' + error.message);
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


    static async updateVisit(visitID, data, files = []) {
        try {
            const { date, time, duration, location, status, comment } = data;
            const visit = await Visit.findByPk(visitID, {
                include: [{ model: Timesheet, include: [User] }],
            });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }

            // Determine current folder
            const oldDate = visit.date;
            const oldTime = visit.time.replace(/:/g, '-');
            const supervisorName = visit.Timesheet.User.firstname.toLowerCase();
            const oldFolderName = `${oldDate}_${oldTime}_${supervisorName}`;
            const oldFolderPath = path.join(__dirname, '../uploads/photos', oldFolderName);

            // New folder if date or time changes
            const newDate = date || visit.date;
            const newTime = (time || visit.time).replace(/:/g, '-');
            const newFolderName = `${newDate}_${newTime}_${supervisorName}`;
            const newFolderPath = path.join(__dirname, '../uploads/photos', newFolderName);

            let photoPaths = visit.photos;
            if (files.length > 0) {
                // New photos uploaded: replace existing ones
                if (fs.existsSync(oldFolderPath)) {
                    fs.rmSync(oldFolderPath, { recursive: true, force: true }); // Delete old folder
                }
                if (!fs.existsSync(newFolderPath)) {
                    fs.mkdirSync(newFolderPath, { recursive: true });
                }
                photoPaths = files.map(file => `/uploads/photos/${newFolderName}/${file.filename}`);
            } else if (oldFolderName !== newFolderName && fs.existsSync(oldFolderPath)) {
                // No new photos, but folder name changed: rename folder
                fs.renameSync(oldFolderPath, newFolderPath);
                photoPaths = visit.photos.map(p => p.replace(oldFolderName, newFolderName));
            }

            visit.date = newDate;
            visit.time = time || visit.time;
            visit.duration = duration || visit.duration;
            visit.location = location || visit.location;
            visit.status = status || visit.status;
            visit.photos = photoPaths;
            visit.comment = comment || visit.comment;
            await visit.save();
            return visit.reload();
        } catch (error) {
            const err = new Error('Failed to update visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
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
            const supervisorName = visit.Timesheet.User.firstname.toLowerCase();
            const folderName = `${date}_${time}_${supervisorName}`;
            const folderPath = path.join(__dirname, '../uploads/photos', folderName);

            if (fs.existsSync(folderPath)) {
                fs.rmSync(folderPath, { recursive: true, force: true }); // Delete folder and photos
            }
            await visit.destroy();
            return { message: 'Visit and associated photos deleted successfully' };
        } catch (error) {
            const err = new Error('Failed to delete visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

}

module.exports = VisitService;