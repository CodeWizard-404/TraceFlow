// controllers/receiptBookController.js
const ReceiptBookService = require('../services/receiptBookService');

class ReceiptBookController {
    static async createReceiptBook(req, res) {
        try {
            const { number, type } = req.body;
            if (!number || !type) {
                return res.status(400).json({ error: 'Number and type are required' });
            }
            const purchaseUserID = req.user.userID;
            const receiptBook = await ReceiptBookService.createReceiptBook(number, type, purchaseUserID);
            res.status(201).json(receiptBook);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Create receipt book failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to create receipt book due to an internal error' });
        }
    }

    static async getAllReceiptBooks(req, res) {
        try {
            const receiptBooks = await ReceiptBookService.getAllReceiptBooks();
            res.json(receiptBooks);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all receipt books failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve receipt books due to an internal error' });
        }
    }

    static async getReceiptBookById(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            res.json(receiptBook);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get receipt book by ID failed:`, error);
            res.status(404).json({ error: error.message || 'Receipt book not found' });
        }
    }

    static async updateReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            const updates = req.body;
            if (!bookID) {
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const userID = req.user.userID;
            const receiptBook = await ReceiptBookService.updateReceiptBook(bookID, updates, userID);
            res.json(receiptBook);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update receipt book failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to update receipt book due to an internal error' });
        }
    }

    static async deleteReceiptBook(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const userID = req.user.userID;
            const result = await ReceiptBookService.deleteReceiptBook(bookID, userID);
            res.status(200).json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Delete receipt book failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to delete receipt book due to an internal error' });
        }
    }

    static async sendToSupplier(req, res) {
        try {
            const { bookID, supplierEmail } = req.body;
            if (!bookID || !supplierEmail) {
                return res.status(400).json({ error: 'Book ID and supplier email are required' });
            }
            const userID = req.user.userID;
            const receiptBook = await ReceiptBookService.sendBookToSupplier(bookID, supplierEmail, userID);
            res.json({ message: `Book ${receiptBook.number} has been sent to ${supplierEmail}` });
        } catch (error) {
            console.error(`${new Date().toISOString()} - Send receipt book to supplier failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to send receipt book to supplier due to an internal error' });
        }
    }

    static async transferReceiptBookToUser(req, res) {
        try {
            const { bookID } = req.body;
            if (!bookID) {
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const newOwnerID = req.user.userID;
            const result = await ReceiptBookService.transferToUser(bookID, newOwnerID);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Transfer receipt book failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to initiate receipt book transfer due to an internal error' });
        }
    }

    static async validateTransferToUser(req, res) {
        try {
            const { otpCode, bookID } = req.body;
            if (!otpCode || !bookID) {
                return res.status(400).json({ error: 'OTP code and book ID are required' });
            }
            const newOwnerID = req.user.userID;
            const receiptBook = await ReceiptBookService.validateTransferToUser(bookID, newOwnerID, otpCode);
            res.json(receiptBook);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Validate transfer failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to validate receipt book transfer due to an internal error' });
        }
    }

    static async assignToAgent(req, res) {
        try {
            const { agentPhone, agentWallet, bookID } = req.body;
            if (!agentPhone || !agentWallet || !bookID) {
                return res.status(400).json({ error: 'Agent phone, wallet, and book ID are required' });
            }
            const supervisorID = req.user.userID;
            const result = await ReceiptBookService.assignToAgent(bookID, agentPhone, agentWallet, supervisorID);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Assign to agent failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to assign receipt book to agent due to an internal error' });
        }
    }

    static async validateAgentAssignment(req, res) {
        try {
            const { agentPhone, agentWallet, otpCode, bookID } = req.body;
            if (!agentPhone || !agentWallet || !otpCode || !bookID) {
                return res.status(400).json({ error: 'Agent phone, wallet, OTP code, and book ID are required' });
            }
            const supervisorID = req.user.userID;
            const receiptBook = await ReceiptBookService.validateAgentAssignment(bookID, agentPhone, agentWallet, otpCode, supervisorID);
            res.json(receiptBook);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Validate agent assignment failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to validate agent assignment due to an internal error' });
        }
    }

    static async getTransferHistory(req, res) {
        try {
            const { bookID } = req.params;
            if (!bookID) {
                return res.status(400).json({ error: 'Book ID is required' });
            }
            const history = await ReceiptBookService.getTransferHistory(bookID);
            res.json(history);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get transfer history failed:`, error);
            res.status(404).json({ error: error.message || 'Failed to retrieve transfer history due to an internal error' });
        }
    }
}

module.exports = ReceiptBookController;