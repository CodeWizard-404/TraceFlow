const express = require('express');
const router = express.Router();
const { requirePermission } = require('../config/security');
const ReceiptBookController = require('../controllers/receiptBookController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Receipt Book Type Routes
router.post('/types', requirePermission('manage_receipt_book_types'), ReceiptBookController.createReceiptBookType);
router.get('/types', requirePermission('access_receipt_book_types'), ReceiptBookController.getAllReceiptBookTypes);
router.get('/types/:typeID', requirePermission('access_receipt_book_types'), ReceiptBookController.getReceiptBookTypeById);
router.put('/types/:typeID', requirePermission('manage_receipt_book_types'), ReceiptBookController.updateReceiptBookType);
router.delete('/types/:typeID', requirePermission('manage_receipt_book_types'), ReceiptBookController.deleteReceiptBookType);
router.get('/holders', requirePermission('access_receipt_book_holders'), ReceiptBookController.getReceiptBookHolders);

// Receipt Book Routes
router.post('/', requirePermission('create_receipt_books'), ReceiptBookController.createReceiptBook);
router.get('/', requirePermission('access_all_receipt_books'), ReceiptBookController.getAllReceiptBooks);
router.get('/:bookID', requirePermission('access_receipt_book_details'), ReceiptBookController.getReceiptBookById);
router.post('/holder/:holderID', requirePermission('access_receipt_books_by_holder'), ReceiptBookController.getReceiptBooksByHolder);
router.get('/number/:number', requirePermission('access_receipt_books_by_number'), ReceiptBookController.getReceiptBookByNumber);
router.put('/:bookID', requirePermission('update_receipt_books'), ReceiptBookController.updateReceiptBook);
router.delete('/:bookID', requirePermission('delete_receipt_books'), ReceiptBookController.deleteReceiptBook);
router.post('/upload-csv',
    requirePermission('create_receipt_books'),
    upload.single('csvFile'),
    ReceiptBookController.uploadReceiptBooksCSV
);

// Transfer Routes
router.post('/send', requirePermission('send_receipt_books'), ReceiptBookController.sendToSupplier);
router.post('/receive', requirePermission('collect_supplier_receipt_books'), ReceiptBookController.collectFromSupplier);
router.post('/transfer', requirePermission('transfer_receipt_books'), ReceiptBookController.transfer);
router.post('/validate-transfer', requirePermission('validate_receipt_books_transfer'), ReceiptBookController.validateTransfer);
router.get('/:bookID/history', requirePermission('access_receipt_book_history'), ReceiptBookController.getTransferHistory);

module.exports = router;