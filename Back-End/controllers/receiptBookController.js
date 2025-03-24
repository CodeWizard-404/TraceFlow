// controllers/receiptBookController.js
const ReceiptBookService = require('../services/receiptBookService');

class ReceiptBookController {
    static async createReceiptBook(req, res) {
        try {
            const { number, type } = req.body;
            if (!number || !type) return res.status(400).json({ error: 'Number and type are required' });
            const receiptBook = await ReceiptBookService.createReceiptBook(number, type, req.user.userID);
            res.status(201).json(receiptBook);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Create receipt book failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to create receipt book' });
        }
    }

    static async getAllReceiptBooks(req, res) {
        try {
            const receiptBooks = await ReceiptBookService.getAllReceiptBooks();
            res.json(receiptBooks);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get all receipt books failed:`, error);
            res.status(500).json({ error: error.message || 'Failed to retrieve receipt books' });
        }
    }

    static async getReceiptBookById(req, res) {
        try {
            const { bookID } = req.params;
            const receiptBook = await ReceiptBookService.getReceiptBookById(bookID);
            res.json(receiptBook);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get receipt book failed:`, error);
            res.status(404).json({ error: error.message || 'Receipt book not found' });
        }
    }

    static async sendToSupplier(req, res) {
        try {
            const { bookIDs, supplierEmail } = req.body;
            if (!Array.isArray(bookIDs) || !supplierEmail) return res.status(400).json({ error: 'Book IDs (array) and supplier email are required' });
            const result = await ReceiptBookService.sendToSupplier(bookIDs, supplierEmail, req.user.userID);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Send to supplier failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to send books to supplier' });
        }
    }

    static async transfer(req, res) {
        try {
            const { bookIDs, recipientID, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID) return res.status(400).json({ error: 'Book IDs (array) and recipient ID are required' });
            const result = await ReceiptBookService.transfer(bookIDs, recipientID, req.user.userID, recipientType);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Transfer failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to initiate transfer' });
        }
    }
    
    static async collectFromSupplier(req, res) {
        try {
            const { bookIDs, userID } = req.body;
            if (!Array.isArray(bookIDs) || !userID) return res.status(400).json({ error: 'Book IDs (array) and user ID are required' });
            const result = await ReceiptBookService.collectFromSupplier(bookIDs, userID);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Collect from supplier failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to collect books from supplier' });
        }
    }


    static async validateTransfer(req, res) {
        try {
            const { bookIDs, recipientID, otpCode, recipientType = 'user' } = req.body;
            if (!Array.isArray(bookIDs) || !recipientID || !otpCode) {
                return res.status(400).json({ error: 'Book IDs (array), recipient ID, and OTP code are required' });
            }
            const result = await ReceiptBookService.validateTransfer(bookIDs, recipientID, otpCode, recipientType);
            res.json(result);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Validate transfer failed:`, error);
            res.status(400).json({ error: error.message || 'Failed to validate transfer' });
        }
    }

    static async getTransferHistory(req, res) {
        try {
            const { bookID } = req.params;
            const history = await ReceiptBookService.getTransferHistory(bookID);
            res.json(history);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get transfer history failed:`, error);
            res.status(404).json({ error: error.message || 'Failed to retrieve transfer history' });
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

}

module.exports = ReceiptBookController;