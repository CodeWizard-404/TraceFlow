import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../models/receipt_book.dart';
import '../services/receipt_book_service.dart';

class ReceiptBookProvider with ChangeNotifier {
  final ReceiptBookService _receiptBookService;
  List<ReceiptBook> _receiptBooks = [];
  ReceiptBook? _currentReceiptBook;
  bool _isLoading = false;
  String? _errorMessage;

  ReceiptBookProvider({ReceiptBookService? receiptBookService})
      : _receiptBookService = receiptBookService ?? ReceiptBookService();

  List<ReceiptBook> get receiptBooks => _receiptBooks;
  ReceiptBook? get currentReceiptBook => _currentReceiptBook;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchAndFilterReceiptBooksByHolder(String? userID) async {
    if (userID == null) {
      if (kDebugMode) print('No user ID provided, clearing receipt books');
      _receiptBooks = [];
      _isLoading = false;
      notifyListeners();
      return;
    }
    if (kDebugMode) print('Fetching receipt books for holder: $userID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final allBooks = await _receiptBookService.fetchAllReceiptBooks();
      _receiptBooks = allBooks.where((book) => book.currentHolderID == userID).toList();
      if (kDebugMode) print('Fetched ${_receiptBooks.length} receipt books for holder: $userID');
    } catch (e) {
      _receiptBooks = [];
      _errorMessage = 'Failed to fetch receipt books: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchReceiptBookById(String bookID) async {
    if (kDebugMode) print('Fetching receipt book by ID: $bookID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _currentReceiptBook = await _receiptBookService.fetchReceiptBookById(bookID);
      if (kDebugMode) {
        print(_currentReceiptBook != null
            ? 'Fetched receipt book: ${_currentReceiptBook!.bookID}'
            : 'No receipt book found for ID: $bookID');
      }
    } catch (e) {
      _currentReceiptBook = null;
      _errorMessage = 'Failed to fetch receipt book: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchReceiptBookByNumber(String number) async {
    if (kDebugMode) print('Fetching receipt book by number: $number');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _currentReceiptBook = await _receiptBookService.fetchReceiptBookByNumber(number);
      if (kDebugMode) {
        print(_currentReceiptBook != null
            ? 'Fetched receipt book: ${_currentReceiptBook!.bookID}'
            : 'No receipt book found for number: $number');
      }
    } catch (e) {
      _currentReceiptBook = null;
      _errorMessage = 'Failed to fetch receipt book: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> transferReceiptBooks({
    required List<String> bookIDs,
    required String recipientID,
    required String recipientType,
  }) async {
    if (kDebugMode) print('Transferring receipt books: $bookIDs');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await _receiptBookService.transferReceiptBooks(
        bookIDs: bookIDs,
        recipientID: recipientID,
        recipientType: recipientType,
      );
      final holderID = _currentReceiptBook?.currentHolderID;
      if (holderID != null) {
        await fetchAndFilterReceiptBooksByHolder(holderID);
      }
      if (kDebugMode) print('Transferred receipt books successfully');
    } catch (e) {
      _errorMessage = 'Failed to transfer receipt books: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
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
  }) async {
    if (kDebugMode) print('Validating transfer for books: $bookIDs');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await _receiptBookService.validateTransfer(
        bookIDs: bookIDs,
        recipientID: recipientID,
        otpCode: otpCode,
        recipientType: recipientType,
      );
      final holderID = _currentReceiptBook?.currentHolderID;
      if (holderID != null) {
        await fetchAndFilterReceiptBooksByHolder(holderID);
      }
      if (kDebugMode) print('Validated transfer successfully');
    } catch (e) {
      _errorMessage = 'Failed to validate transfer: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    if (kDebugMode) print('Clearing error message');
    _errorMessage = null;
    notifyListeners();
  }
}