// controllers/receiptStubController.js
const ReceiptStubService = require('../services/receiptStubService');

class ReceiptStubController {
    static async collectStub(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const supervisorID = req.user.userID;
            const result = await ReceiptStubService.collectStub(bookID, supervisorID);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Collect stub failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to initiate stub collection due to an internal error' });
        }
    }

    static async validateStubCollection(req, res) {
        try {
            const { bookID } = req.params;
            const { otpCode } = req.body;
            if (!bookID || !otpCode) {
                return res.status(400).json({ error: 'Book ID and OTP code are required' });
            }
            const supervisorID = req.user.userID;
            const stub = await ReceiptStubService.validateStubCollection(bookID, supervisorID, otpCode);
            res.json(stub);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Validate stub collection failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to validate stub collection due to an internal error' });
        }
    }

    static async transmitStub(req, res) {
        try {
            const { bookID } = req.params;
            const { newOwnerID } = req.body;
            if (!bookID || !newOwnerID) {
                return res.status(400).json({ error: 'Book ID and new owner ID are required' });
            }
            const currentUserID = req.user.userID;
            const result = await ReceiptStubService.transmitStub(bookID, newOwnerID, currentUserID);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Transmit stub failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to initiate stub transmission due to an internal error' });
        }
    }

    static async validateTransmitStub(req, res) {
        try {
            const { bookID } = req.params;
            const { newOwnerID, otpCode } = req.body;
            if (!bookID || !newOwnerID || !otpCode) {
                return res.status(400).json({ error: 'Book ID, new owner ID, and OTP code are required' });
            }
            const currentUserID = req.user.userID;
            const stub = await ReceiptStubService.validateTransmitStub(bookID, newOwnerID, currentUserID, otpCode);
            res.json(stub);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Validate stub transmission failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to validate stub transmission due to an internal error' });
        }
    }

    static async archiveStub(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const stockManagerID = req.user.userID;
            const stub = await ReceiptStubService.archiveStub(bookID, stockManagerID);
            res.json(stub);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Archive stub failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to archive stub due to an internal error' });
        }
    }
}

module.exports = ReceiptStubController;