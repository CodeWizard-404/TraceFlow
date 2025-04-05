import 'package:flutter/foundation.dart';
import '../models/receipt_book.dart';
import '../services/receipt_book_service.dart';

class ReceiptBookProvider with ChangeNotifier {
  List<ReceiptBook> _receiptBooks = [];
  ReceiptBook? _currentReceiptBook;
  bool _isLoading = false;

  List<ReceiptBook> get receiptBooks => _receiptBooks;
  ReceiptBook? get currentReceiptBook => _currentReceiptBook;
  bool get isLoading => _isLoading;

  Future<void> fetchAndFilterReceiptBooksByHolder(String userID, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      final allBooks = await ReceiptBookService.fetchAllReceiptBooks(token);
      _receiptBooks = allBooks.where((book) => book.currentHolderID == userID).toList();
    } catch (e) {
      _receiptBooks = [];
      throw Exception('Failed to fetch and filter receipt books: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchReceiptBookById(String bookID, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentReceiptBook = await ReceiptBookService.fetchReceiptBookById(bookID, token);
    } catch (e) {
      _currentReceiptBook = null;
      throw Exception('Failed to fetch receipt book: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> transferReceiptBooks({
    required List<String> bookIDs,
    required String recipientID,
    required String recipientType,
    required String token,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      await ReceiptBookService.transferReceiptBooks(
        bookIDs: bookIDs,
        recipientID: recipientID,
        recipientType: recipientType,
        token: token,
      );
      await fetchAndFilterReceiptBooksByHolder(_currentReceiptBook?.currentHolderID ?? '', token);
    } catch (e) {
      throw Exception('Failed to transfer receipt books: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> validateTransfer({
    required List<String> bookIDs,
    required String recipientID,
    required String otpCode,
    required String recipientType,
    required String token,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentReceiptBook = await ReceiptBookService.validateTransfer(
        bookIDs: bookIDs,
        recipientID: recipientID,
        otpCode: otpCode,
        recipientType: recipientType,
        token: token,
      );
      await fetchAndFilterReceiptBooksByHolder(_currentReceiptBook?.currentHolderID ?? '', token);
    } catch (e) {
      throw Exception('Failed to validate transfer: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}