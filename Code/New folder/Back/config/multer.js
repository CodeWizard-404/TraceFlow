const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Timesheet, User } = require('../models');
const logger = require('../utils/logger');

// Disk storage for timesheet photos
const diskStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const { id } = req.params; // visitID from the route
        try {
            const visit = await require('../models').Visit.findByPk(id, {
                include: [{ model: Timesheet, include: [User] }],
            });
            if (!visit) {
                return cb(new Error('Visit not found'));
            }

            const date = visit.date; // e.g., "2025-03-27"
            const time = visit.time.replace(/:/g, '-'); // e.g., "10-00"
            const supervisorName = `${visit.Timesheet.User.firstname.toLowerCase()}_${visit.Timesheet.User.lastname.toLowerCase()}`; // e.g., "supervisor_user"
            const folderName = `${date}_${time}_${supervisorName}`; // e.g., "2025-03-27_10-00_supervisor_user"
            const uploadPath = path.join(__dirname, '../Uploads/photos', folderName);

            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }

            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        // Initialize a counter on the request object if it doesn’t exist
        if (!req.fileCounter) {
            req.fileCounter = 0;
        }

        // Generate a base timestamp (once per request)
        if (!req.timestamp) {
            req.timestamp = new Date()
                .toISOString()
                .replace(/T/, '_')
                .replace(/:/g, '-')
                .replace(/\..+/, '');
        }

        // Use the counter to create a unique suffix and increment it
        const fileIndex = req.fileCounter;
        const uniqueSuffix = `${req.timestamp}_${fileIndex}`; // e.g., "2025-03-26_17-27-42_0", "..._1", etc.
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uniqueSuffix}${ext}`);

        // Increment the counter for the next file
        req.fileCounter += 1;
    },
});

// Memory storage for profile pictures (PFP)
const memoryStorage = multer.memoryStorage();

// Shared file filter for both uploads
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const extname = /\.(jpeg|jpg|png)$/i.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.includes(file.mimetype);
    if (extname && mimetype) {
        return cb(null, true);
    }
    logger.error(`File rejected: mimetype=${file.mimetype}, originalname=${file.originalname}`);
    cb(new Error('Only JPEG/JPG/PNG images are allowed'), false);
};

const uploadPhotos = multer({
    storage: diskStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
}).array('photos', 10); // Add max file count for clarity

// Add error handling middleware
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        logger.error(`Multer error: ${err.message}, field=${err.field}`);
        return res.status(400).json({ error: `Multer error: ${err.message}` });
    }
    if (err) {
        logger.error(`File upload error: ${err.message}`);
        return res.status(400).json({ error: err.message });
    }
    next();
};

// Export two multer instances
module.exports = {
    uploadPhotos: [uploadPhotos, handleMulterError],
    uploadPFP: multer({
        storage: memoryStorage,
        fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    }),
};