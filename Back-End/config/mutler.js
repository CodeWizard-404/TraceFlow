// config/multer.js
const multer = require('multer');
const path = require('path');
const { nanoid } = require('nanoid');
const fs = require('fs');
const { Timesheet, User } = require('../models');

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const { id } = req.params; // visitID from the route
        try {
            // Fetch visit details
            const visit = await require('../models').Visit.findByPk(id, {
                include: [{ model: Timesheet, include: [User] }],
            });
            if (!visit) {
                return cb(new Error('Visit not found'));
            }

            // Extract date, time, and supervisor name
            const date = visit.date; // e.g., "2025-03-27"
            const time = visit.time.replace(/:/g, '-'); // e.g., "10:00" -> "10-00"
            const supervisorName = visit.Timesheet.User.firstname.toLowerCase(); // e.g., "john"

            // Construct folder name
            const folderName = `${date}_${time}_${supervisorName}`;
            const uploadPath = path.join(__dirname, '../uploads/photos', folderName);

            // Create folder if it doesn’t exist
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }

            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${nanoid()}-${Date.now()}`;
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
        return cb(null, true);
    }
    cb(new Error('Only JPEG/JPG/PNG images are allowed'), false);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

module.exports = upload;