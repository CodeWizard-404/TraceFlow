// controllers/receiptStubController.js
const ReceiptStubService = require('../services/receiptStubService');

class ReceiptStubController {
    static async collectStub(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) return res.status(400).json({ error: 'Book ID is required' });
            const result = await ReceiptStubService.collectStub(bookID, req.user.userID);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Collect stub failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to initiate stub collection' });
        }
    }

    static async validateStubCollection(req, res) {
        try {
            const { bookID } = req.params;
            const { otpCode } = req.body;
            if (!bookID || !otpCode) return res.status(400).json({ error: 'Book ID and OTP code are required' });
            const result = await ReceiptStubService.validateStubCollection(bookID, req.user.userID, otpCode);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Validate stub collection failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to validate stub collection' });
        }
    }

    static async archiveStub(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) return res.status(400).json({ error: 'Book ID is required' });
            const result = await ReceiptStubService.archiveStub(bookID, req.user.userID);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Archive stub failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to archive stub' });
        }
    }
}

module.exports = ReceiptStubController;