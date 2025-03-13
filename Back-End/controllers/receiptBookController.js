const ReceiptBookService = require('../services/receiptBookService');

class ReceiptBookController {
    static async createReceiptBook(req, res) {
        try {
            const { number, type } = req.body;
            const receiptBook = await ReceiptBookService.createReceiptBook(number, type);
            res.status(201).json(receiptBook);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async getAllReceiptBooks(req, res) {
        try {
            const receiptBooks = await ReceiptBookService.getAllReceiptBooks();
            res.json(receiptBooks);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async getReceiptBookById(req, res) {
        try {
            const { bookID } = req.params;
            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            res.json(receiptBook);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    static async updateReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            const updates = req.body;
            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            await receiptBook.update(updates);
            res.json(receiptBook);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async deleteReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            await receiptBook.destroy();
            res.status(204).send();
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async sendQRCodeToSupplier(req, res) {
        try {
            const { bookID, supplierEmail } = req.body;
            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            // In a real scenario, you'd send the QR code via email here
            res.json({ message: `QR code for book ${receiptBook.number} would be sent to ${supplierEmail}` });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async transferReceiptBookToUser(req, res) {
        try {
            const { bookID, newOwnerID } = req.body;
            const result = await ReceiptBookService.transferReceiptBookToUser(bookID, newOwnerID);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async validateTransferToUser(req, res) {
        try {
            const { bookID, newOwnerID, otpCode } = req.body;
            const receiptBook = await ReceiptBookService.validateTransferToUser(bookID, newOwnerID, otpCode);
            res.json(receiptBook);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async assignToAgent(req, res) {
        try {
            const { bookID, agentPhone } = req.body;
            const result = await ReceiptBookService.assignToAgent(bookID, agentPhone);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

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