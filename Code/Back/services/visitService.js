const { Visit, Agent, Reason, Checklist, Timesheet, User, Delegation, Governorate, Region, sequelize } = require('../models');
const { parseTLV } = require('../utils/qrParser');
const ChecklistService = require('./checklistService');
const ReasonService = require('./reasonService');
const GoogleCalendarService = require('./googleCalendarService');
const OTPService = require('./otpService');
const { sendSMS } = require('../config/sms');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const retry = require('async-retry');

class VisitService {
    static async createVisit(data, options = {}) {
        const { date, time, agentID, supervisorID, timesheetID, reasons, checklists, location, status = 'pending' } = data;

        if (!date || !time || !supervisorID) {
            const error = new Error('Missing required fields');
            error.status = 400;
            throw error;
        }

        const transaction = options.transaction || await sequelize.transaction();
        let isLocalTransaction = !options.transaction;

        try {
            const dateObj = new Date(date);
            const year = dateObj.getFullYear();
            const weekNumber = this.getISOWeekNumber(dateObj);

            let targetTimesheet;
            if (timesheetID) {
                targetTimesheet = await Timesheet.findByPk(timesheetID, {
                    include: [{ model: User }],
                    transaction
                });
                if (!targetTimesheet) {
                    const error = new Error('Specified timesheet not found');
                    error.status = 404;
                    throw error;
                }
                if (!targetTimesheet.User) {
                    const error = new Error('Timesheet has no associated user');
                    error.status = 500;
                    throw error;
                }
            } else {
                targetTimesheet = await Timesheet.findOne({
                    where: {
                        weekNumber,
                        year,
                        supervisorID,
                    },
                    include: [{ model: Visit }, { model: User }],
                    transaction,
                });

                if (!targetTimesheet) {
                    try {
                        targetTimesheet = await Timesheet.create(
                            {
                                weekNumber,
                                year,
                                supervisorID,
                                status,
                            },
                            { transaction }
                        );
                        const user = await User.findByPk(supervisorID, { transaction });
                        if (!user) {
                            const error = new Error('Supervisor not found');
                            error.status = 404;
                            throw error;
                        }
                        targetTimesheet.User = user;
                    } catch (error) {
                        if (error.name === 'SequelizeUniqueConstraintError') {
                            targetTimesheet = await Timesheet.findOne({
                                where: { weekNumber, year, supervisorID },
                                include: [{ model: Visit }, { model: User }],
                                transaction,
                            });
                            if (!targetTimesheet) {
                                throw new Error('Failed to find or create timesheet after unique constraint error');
                            }
                        } else {
                            throw error;
                        }
                    }
                }
                if (!targetTimesheet.User) {
                    const error = new Error('Timesheet has no associated user');
                    error.status = 500;
                    throw error;
                }
            }

            const visitLocation = await this.getFormattedLocation(agentID, location);

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

            if (reasons && Array.isArray(reasons) && reasons.length > 0) {
                try {
                    const reasonIds = reasons.map((r) => r.id).filter((id) => id);
                    if (reasonIds.length > 0) {
                        const createdReasons = await ReasonService.getItemsByIds(reasonIds, { transaction });
                        if (createdReasons.length > 0) {
                            await visit.setReasons(createdReasons, { transaction });
                        }
                    }
                } catch (error) {
                    throw new Error(`Failed to attach reasons to visit ${visit.visitID}: ${error.message}`);
                }
            }

            if (checklists && Array.isArray(checklists) && checklists.length > 0) {
                try {
                    const checklistIds = checklists.map((c) => c.id).filter((id) => id);
                    if (checklistIds.length > 0) {
                        const createdChecklists = await ChecklistService.getItemsByIds(checklistIds, { transaction });
                        if (createdChecklists.length > 0) {
                            await visit.setChecklists(createdChecklists, { transaction });
                        } else {
                            throw new Error(`No valid checklists found for visit ${visit.visitID}`);
                        }
                    }
                } catch (error) {
                    throw new Error(`Failed to attach checklists to visit ${visit.visitID}: ${error.message}`);
                }
            }

            const timesheetWithVisits = await Timesheet.findByPk(targetTimesheet.timesheetID, {
                include: [{ model: Visit }],
                transaction,
            });

            const visitStatuses = [
                ...timesheetWithVisits.Visits.map((v) => v.status),
                status,
            ];
            const uniqueStatuses = [...new Set(visitStatuses)];

            if (uniqueStatuses.length > 1) {
                timesheetWithVisits.status = 'pending';
            } else {
                timesheetWithVisits.status = uniqueStatuses[0];
            }
            await timesheetWithVisits.save({ transaction });

            const reloadedVisit = await visit.reload({ include: [Reason, Checklist, Agent], transaction });

            let warning = null;
            const user = await User.findByPk(targetTimesheet.User.userID, { transaction });
            if (user.hasCalendarAccess) {
                try {
                    const userId = targetTimesheet.User.userID;
                    if (typeof userId !== 'string') {
                        throw new Error(`Invalid userId: ${userId}`);
                    }
                    const event = await GoogleCalendarService.createCalendarEvent(userId, visit.visitID, { transaction });
                    visit.calendarEventId = event.id;
                    await visit.save({ transaction });
                    await GoogleCalendarService.notifyCalendarUpdate(userId, {
                        visitId: visit.visitID,
                        calendarEventId: event.id,
                        action: 'created',
                    });
                } catch (error) {
                    warning = `Visit ${visit.visitID} created successfully for user ${targetTimesheet.User.userID}, but Google Calendar event creation failed: ${error.message}`;
                }
            }

            if (isLocalTransaction) await transaction.commit();
            return {
                visit: reloadedVisit,
                warning,
            };
        } catch (error) {
            if (isLocalTransaction) await transaction.rollback();
            const err = new Error('Failed to create visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async logVisit(visitID, data, files) {
        const transaction = await sequelize.transaction();
        try {
            const { duration, checklistUpdates, comment, date, time, status } = data;
            if (!files || files.length === 0) {
                const error = new Error('At least one photo is required to log a visit');
                error.status = 400;
                throw error;
            }

            const visit = await Visit.findByPk(visitID, {
                include: [
                    { model: Timesheet, include: [User] },
                    { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                    { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } }
                ],
                transaction,
            });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            if (!visit.Timesheet || !visit.Timesheet.User) {
                const error = new Error('Timesheet or associated user not found');
                error.status = 500;
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
            const oldFolderPath = path.join(__dirname, '../uploads/photos', oldFolderName);

            const newTimeForFolder = newTime.replace(/:/g, '-');
            const newFolderName = `${newDate}_${newTimeForFolder}_${supervisorName}`;
            const newFolderPath = path.join(__dirname, '../uploads/photos', newFolderName);

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
            visit.status = ['pending', 'visited', 'rejected', 'validated'].includes(status) ? status : 'visited';
            await visit.save({ transaction });

            const reloadedVisit = await visit.reload({ include: [Reason, Checklist, Agent], transaction });

            let warning = null;
            const user = await User.findByPk(visit.Timesheet.User.userID, { transaction });
            if (user.hasCalendarAccess) {
                try {
                    const userId = visit.Timesheet.User.userID;
                    if (typeof userId !== 'string') {
                        throw new Error(`Invalid userId: ${userId}`);
                    }
                    const event = await GoogleCalendarService.updateCalendarEvent(userId, visitID, { transaction });
                    await GoogleCalendarService.notifyCalendarUpdate(userId, {
                        visitId: visitID,
                        calendarEventId: event.id,
                        action: 'updated',
                    });
                } catch (error) {
                    warning = `Visit ${visitID} logged successfully for user ${visit.Timesheet.User.userID}, but Google Calendar event update failed: ${error.message}`;
                }
            }

            await transaction.commit();
            return {
                visit: reloadedVisit,
                warning,
            };
        } catch (error) {
            await transaction.rollback();
            const err = new Error('Failed to log visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async updateVisit(visitID, data, files = [], actorID, options = {}) {
        const transaction = options.transaction || await sequelize.transaction();
        const isLocalTransaction = !options.transaction;
        try {
            const { date, time, duration, location, status, comment, agentID, checklists, reasons, photosToRemove, supervisorID } = data;

            const visit = await retry(async () => {
                const v = await Visit.findByPk(visitID, {
                    include: [
                        { model: Timesheet, include: [User] },
                        { model: Reason, attributes: ['reasonID', 'item'], through: { attributes: [] } },
                        { model: Checklist, attributes: ['checklistID', 'item'], through: { attributes: [] } }
                    ],
                    transaction
                });
                if (!v) {
                    const error = new Error('Visit not found');
                    error.status = 404;
                    throw error;
                }
                if (!v.Timesheet) {
                    const error = new Error('Timesheet not found');
                    error.status = 404;
                    throw error;
                }
                if (!v.Timesheet.User) {
                    const error = new Error('Supervisor not found');
                    error.status = 500;
                    throw error;
                }
                return v;
            }, {
                retries: 3,
                factor: 2,
                minTimeout: 1000,
                maxTimeout: 5000
            });

            const oldDate = visit.date;
            const oldTime = visit.time.replace(/:/g, '-');
            const supervisorName = `${visit.Timesheet.User.firstname.toLowerCase()}_${visit.Timesheet.User.lastname.toLowerCase()}`;
            const folderName = `${oldDate}_${oldTime}_${supervisorName}`;
            const folderPath = path.join(__dirname, '../uploads/photos', folderName);

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
                    transaction
                });
                if (!targetTimesheet) {
                    targetTimesheet = await Timesheet.create({
                        weekNumber: newWeekNumber,
                        year: newYear,
                        supervisorID: supervisorID,
                        status: 'pending',
                    }, { transaction });
                }
                visit.timesheetID = targetTimesheet.timesheetID;
            } else if (newWeekNumber !== oldTimesheet.weekNumber || newYear !== oldTimesheet.year) {
                targetTimesheet = await Timesheet.findOne({
                    where: {
                        weekNumber: newWeekNumber,
                        year: newYear,
                        supervisorID: oldTimesheet.supervisorID,
                    },
                    transaction
                });
                if (!targetTimesheet) {
                    targetTimesheet = await Timesheet.create({
                        weekNumber: newWeekNumber,
                        year: newYear,
                        supervisorID: oldTimesheet.supervisorID,
                        status: 'pending',
                    }, { transaction });
                }
                visit.timesheetID = targetTimesheet.timesheetID;
            }

            if (agentID !== undefined) {
                if (agentID) {
                    const agent = await Agent.findByPk(agentID, { transaction });
                    if (!agent) {
                        const error = new Error('Agent not found');
                        error.status = 404;
                        throw error;
                    }
                    visit.agentID = agentID;
                    visit.location = await this.getFormattedLocation(agentID, location, { transaction });
                } else {
                    visit.agentID = null;
                    visit.location = location;
                }
            } else {
                visit.location = await this.getFormattedLocation(visit.agentID, location !== undefined ? location : visit.location, { transaction });
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
                const updatedChecklists = await ChecklistService.getItemsByIds(checklistIds, { transaction });
                await visit.setChecklists(updatedChecklists, { transaction });
                for (const checklist of parsedChecklists) {
                    if (checklist.checked !== undefined) {
                        await ChecklistService.updateChecklistStatus(visitID, checklist.id, checklist.checked, { transaction });
                    }
                }
            }

            if (parsedReasons && Array.isArray(parsedReasons)) {
                const reasonIds = parsedReasons.map((r) => r.id);
                const updatedReasons = await ReasonService.getItemsByIds(reasonIds, { transaction });
                await visit.setReasons(updatedReasons, { transaction });
            }

            visit.date = newDate;
            visit.time = time || visit.time;
            visit.duration = duration !== undefined ? duration : visit.duration;
            visit.status = ['pending', 'visited', 'rejected', 'validated'].includes(status) ? status : visit.status;
            visit.photos = photoPaths;
            visit.comment = comment !== undefined ? comment : visit.comment;

            await visit.save({ transaction });

            let warning = null;
            const user = await User.findByPk(visit.Timesheet.User.userID, { transaction });
            if (user.hasCalendarAccess) {
                try {
                    const userId = visit.Timesheet.User.userID;
                    if (typeof userId !== 'string') {
                        throw new Error(`Invalid userId: ${userId}`);
                    }
                    const event = await GoogleCalendarService.updateCalendarEvent(userId, visitID, { transaction });
                    await GoogleCalendarService.notifyCalendarUpdate(userId, {
                        visitId: visitID,
                        calendarEventId: event.id,
                        action: 'updated',
                    });
                } catch (error) {
                    warning = `Visit ${visitID} updated successfully for user ${visit.Timesheet.User.userID}, but Google Calendar event update failed: ${error.message}`;
                }
            }

            const reloadedVisit = await visit.reload({ include: [Checklist, Reason, Agent], transaction });
            if (isLocalTransaction) await transaction.commit();
            return {
                visit: reloadedVisit,
                warning,
            };
        } catch (error) {
            if (isLocalTransaction) await transaction.rollback();
            const err = new Error('Failed to update visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async deleteVisit(visitID, actorID) {
        const transaction = await sequelize.transaction();
        try {
            const visit = await Visit.findByPk(visitID, {
                include: [{ model: Timesheet, include: [User] }],
                transaction
            });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            if (!visit.Timesheet || !visit.Timesheet.User) {
                const error = new Error('Timesheet or associated user not found');
                error.status = 500;
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

            let warning = null;
            const user = await User.findByPk(visit.Timesheet.User.userID, { transaction });
            if (user.hasCalendarAccess) {
                try {
                    const userId = visit.Timesheet.User.userID;
                    if (typeof userId !== 'string') {
                        throw new Error(`Invalid userId: ${userId}`);
                    }
                    await GoogleCalendarService.deleteCalendarEvent(userId, visitID);
                    await GoogleCalendarService.notifyCalendarUpdate(userId, {
                        visitId: visitID,
                        action: 'deleted',
                    });
                } catch (error) {
                    warning = `Visit ${visitID} deleted successfully for user ${visit.Timesheet.User.userID}, but Google Calendar event deletion failed: ${error.message}`;
                }
            }

            await visit.destroy({ transaction });
            await transaction.commit();
            return {
                message: 'Visit and associated photos deleted successfully',
                warning,
            };
        } catch (error) {
            await transaction.rollback();
            const err = new Error('Failed to delete visit: ' + error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async validateVisitOTP(visitId, otpCode, actorID) {
        const transaction = await sequelize.transaction();
        try {
            const visit = await Visit.findByPk(visitId, { transaction });
            if (!visit) {
                const error = new Error('Visit not found');
                error.status = 404;
                throw error;
            }
            if (!visit.agentID) {
                await transaction.commit();
                return { valid: true, message: 'OTP validation skipped for recruitment visit' };
            }
            await OTPService.validateOTP(visit.agentID, otpCode, 'agent');
            await transaction.commit();
            return { valid: true, message: 'OTP validated successfully' };
        } catch (error) {
            await transaction.rollback();
            const err = new Error('Failed to validate OTP: ' + error.message);
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

            const otp = await OTPService.generateOTP(visit.agentID, 'agent');
            await sendSMS(agent.phone, `Your OTP for visit ${visitId} verification is ${otp.code}`);

            return { valid: true, message: 'Verification successful, OTP sent to agent' };
        } catch (error) {
            const err = new Error(error.message);
            err.status = error.status || 500;
            throw err;
        }
    }

    static async getFormattedLocation(agentID, providedLocation, options = {}) {
        if (agentID) {
            const agent = await Agent.findByPk(agentID, {
                include: [
                    {
                        model: Delegation,
                        include: [
                            {
                                model: Governorate,
                                include: [Region],
                            },
                        ],
                    },
                ],
                transaction: options.transaction
            });
            if (agent && agent.Delegation && agent.Delegation.Governorate && agent.Delegation.Governorate.Region) {
                return `${agent.Delegation.Governorate.Region.name}, ${agent.Delegation.Governorate.name}, ${agent.Delegation.name}`;
            }
        }
        return providedLocation || null;
    }

    static getISOWeekNumber(date) {
        const tempDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
        const weekNumber = Math.ceil(((tempDate - yearStart) / 86400000 + 1) / 7);
        return weekNumber;
    }

    static async getVisitByID(visitID) {
        try {
            const visit = await Visit.findByPk(visitID, { include: [Checklist, Reason, Agent] });
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