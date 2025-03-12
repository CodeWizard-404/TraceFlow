const ReceiptBookService = require('../services/receiptBookService');

class ReceiptBookController {
    // Create Receipt Book (User Story 63, 64)
    static async createReceiptBook(req, res) {
        try {
            const { number, type } = req.body;
            const receiptBook = await ReceiptBookService.createReceiptBook(number, type);
            res.status(201).json(receiptBook);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Get All Receipt Books (User Story 64)
    static async getAllReceiptBooks(req, res) {
        try {
            const receiptBooks = await ReceiptBookService.getAllReceiptBooks();
            res.json(receiptBooks);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Get Receipt Book by ID
    static async getReceiptBookById(req, res) {
        try {
            const { bookID } = req.params;
            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            res.json(receiptBook);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Update Receipt Book
    static async updateReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            const updates = req.body;
            const receiptBook = await ReceiptBookService.updateReceiptBook(bookID, updates);
            res.json(receiptBook);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Delete Receipt Book
    static async deleteReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            await ReceiptBookService.deleteReceiptBook(bookID);
            res.status(204).send();
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Send QR Code to Supplier (User Story 65)
    static async sendQRCodeToSupplier(req, res) {
        try {
            const { bookID, supplierEmail } = req.body;
            const result = await ReceiptBookService.sendQRCodeToSupplier(bookID, supplierEmail);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Transfer Receipt Book to User (User Stories 66, 67, 16)
    static async transferReceiptBookToUser(req, res) {
        try {
            const { bookID, newOwnerID } = req.body;
            const result = await ReceiptBookService.transferReceiptBookToUser(bookID, newOwnerID);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Validate Transfer to User
    static async validateTransferToUser(req, res) {
        try {
            const { bookID, newOwnerID, otpCode } = req.body;
            const receiptBook = await ReceiptBookService.validateTransferToUser(bookID, newOwnerID, otpCode);
            res.json(receiptBook);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Assign Receipt Book to Agent (User Story 17)
    static async assignToAgent(req, res) {
        try {
            const { bookID, agentPhone } = req.body;
            const result = await ReceiptBookService.assignToAgent(bookID, agentPhone);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    // Validate Assignment to Agent
    static async validateAgentAssignment(req, res) {
        try {
            const { bookID, agentPhone, otpCode } = req.body;
            const receiptBook = await ReceiptBookService.validateAgentAssignment(bookID, agentPhone, otpCode);
            res.json(receiptBook);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}

module.exports = ReceiptBookController;