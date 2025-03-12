const ReceiptStubService = require('../services/receiptStubService');

class ReceiptStubController {
    // Collect Stub from Agent (User Story 18)
    static async collectStub(req, res) {
        try {
            const { bookID } = req.body;
            const result = await ReceiptStubService.collectStub(bookID);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Validate Stub Collection
    static async validateStubCollection(req, res) {
        try {
            const { bookID, supervisorID, otpCode } = req.body;
            const stub = await ReceiptStubService.validateStubCollection(bookID, supervisorID, otpCode);
            res.json(stub);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Transmit Stub to User (User Story 19)
    static async transmitStub(req, res) {
        try {
            const { bookID, newOwnerID } = req.body;
            const stub = await ReceiptStubService.transmitStub(bookID, newOwnerID);
            res.json(stub);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}

module.exports = ReceiptStubController;