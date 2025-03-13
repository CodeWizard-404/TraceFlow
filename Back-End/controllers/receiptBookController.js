const ReceiptBookService = require('../services/receiptBookService');

class ReceiptBookController {
    static async createReceiptBook(req, res) {
        try {
            const { number, type } = req.body;
            const purchaseUserID = req.user.userID;
            const receiptBook = await ReceiptBookService.createReceiptBook(number, type, purchaseUserID);
            res.status(201).json(receiptBook);
        } catch (error) {
            console.error('Error creating receipt book:', error); // Log the full error
            res.status(400).json({ error: error.message });
        }
    }

    static async sendToSupplier(req, res) {
        try {
            const { bookID, supplierEmail } = req.body;
            const UserID = req.user.userID;
            const receiptBook = await ReceiptBookService.sendBookToSupplier(bookID, supplierEmail, UserID);
            res.json({ message: `Book ${receiptBook.number} has been sent to ${supplierEmail}` });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async getAllReceiptBooks(req, res) {
        try {
            const receiptBooks = await ReceiptBookService.getAllReceiptBooks();
            res.json(receiptBooks);
        } catch (error) {
            res.status(500).json({ error: error.message });
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

    static async transferReceiptBookToUser(req, res) {
        try {
            const { bookID } = req.body;
            const newOwnerID = req.user.userID; // Receiver scans QR, uses their own ID
            const result = await ReceiptBookService.transferToUser(bookID, newOwnerID);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async validateTransferToUser(req, res) {
        try {
            const { otpCode, bookID } = req.body;
            const newOwnerID = req.user.userID; // Receiver validates with their own ID
            const receiptBook = await ReceiptBookService.validateTransferToUser(bookID, newOwnerID, otpCode);
            res.json(receiptBook);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async assignToAgent(req, res) {
        try {
            const { agentPhone, bookID } = req.body;
            const supervisorID = req.user.userID; // Supervisor scans QR
            const result = await ReceiptBookService.assignToAgent(bookID, agentPhone, supervisorID);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async validateAgentAssignment(req, res) {
        try {
            const { agentPhone, otpCode, bookID} = req.body;
            const supervisorID = req.user.userID; // Supervisor validates
            const receiptBook = await ReceiptBookService.validateAgentAssignment(bookID, agentPhone, otpCode, supervisorID);
            res.json(receiptBook);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async getTransferHistory(req, res) {
        try {
            const { bookID } = req.params;
            const history = await ReceiptBookService.getTransferHistory(bookID);
            res.json(history);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    static async updateReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            const { number, type } = req.body; // Example fields, adjust as needed
            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            await receiptBook.update({ number, type });
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
}

module.exports = ReceiptBookController;