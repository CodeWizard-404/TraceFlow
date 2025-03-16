const ReceiptStubService = require('../services/receiptStubService');

class ReceiptStubController {
    static async collectStub(req, res) {
        try {
            const { bookID } = req.params;
            const supervisorID = req.user.userID; // Any supervisor can collect
            const result = await ReceiptStubService.collectStub(bookID, supervisorID);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async validateStubCollection(req, res) {
        try {
            const { bookID } = req.params;
            const { otpCode } = req.body;
            const supervisorID = req.user.userID;
            const stub = await ReceiptStubService.validateStubCollection(bookID, supervisorID, otpCode);
            res.json(stub);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async transmitStub(req, res) {
        try {
            const { bookID } = req.params;
            const { newOwnerID } = req.body; // New owner specified in request
            const currentUserID = req.user.userID;
            const result = await ReceiptStubService.transmitStub(bookID, newOwnerID, currentUserID);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async validateTransmitStub(req, res) {
        try {
            const { bookID } = req.params;
            const { newOwnerID, otpCode } = req.body;
            const currentUserID = req.user.userID;
            const stub = await ReceiptStubService.validateTransmitStub(bookID, newOwnerID, currentUserID, otpCode);
            res.json(stub);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async archiveStub(req, res) {
        try {
            const { bookID } = req.params;
            const stockManagerID = req.user.userID;
            const stub = await ReceiptStubService.archiveStub(bookID, stockManagerID);
            res.json(stub);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}

module.exports = ReceiptStubController;