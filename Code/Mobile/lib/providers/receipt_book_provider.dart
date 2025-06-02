import 'package:flutter/foundation.dart';
import '../models/receipt_book.dart';
import '../models/receipt_book_type.dart';
import '../services/auth_service.dart';
import '../services/cookie_manager.dart';
import '../services/receipt_book_service.dart';

class ReceiptBookProvider with ChangeNotifier {
  final ReceiptBookService _receiptBookService;
  List<ReceiptBook> _receiptBooks = [];
  List<ReceiptBookType> _receiptBookTypes = [];
  ReceiptBook? _currentReceiptBook;
  bool _isLoading = false;
  String? _errorMessage;

  ReceiptBookProvider({ReceiptBookService? receiptBookService})
      : _receiptBookService = receiptBookService ?? ReceiptBookService();

  List<ReceiptBook> get receiptBooks => _receiptBooks;
  List<ReceiptBookType> get receiptBookTypes => _receiptBookTypes;
  ReceiptBook? get currentReceiptBook => _currentReceiptBook;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchAllReceiptBooks({
    int page = 1,
    int limit = 10,
    String sortField = 'number',
    String sortOrder = 'ASC',
    String searchQuery = '',
    String filterType = 'all',
    String filterStatus = 'all',
  }) async {
    if (kDebugMode) print('ReceiptBookProvider: Fetching all receipt books with page: $page, limit: $limit');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      _receiptBooks = await _receiptBookService.fetchAllReceiptBooks(
        page: page,
        limit: limit,
        sortField: sortField,
        sortOrder: sortOrder,
        searchQuery: searchQuery,
        filterType: filterType,
        filterStatus: filterStatus,
      );
      if (kDebugMode) print('Fetched ${_receiptBooks.length} receipt books');
    } catch (e) {
      _receiptBooks = [];
      _errorMessage = 'Failed to fetch receipt books: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchReceiptBooksByHolder(String holderID, {String holderType = 'user'}) async {
    if (kDebugMode) print('ReceiptBookProvider: Fetching receipt books for holder: $holderID ($holderType)');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      _receiptBooks = await _receiptBookService.getReceiptBooksByHolder(holderID, holderType);
      if (kDebugMode) print('Fetched ${_receiptBooks.length} receipt books for holder: $holderID');
    } catch (e) {
      _receiptBooks = [];
      _errorMessage = 'Failed to fetch receipt books: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchReceiptBookById(String bookID) async {
    if (kDebugMode) print('ReceiptBookProvider: Fetching receipt book by ID: $bookID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
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
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchReceiptBookByNumber(String number) async {
    if (kDebugMode) print('ReceiptBookProvider: Fetching receipt book by number: $number');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
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
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
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
    if (kDebugMode) print('ReceiptBookProvider: Transferring receipt books: $bookIDs to $recipientID ($recipientType)');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      await _receiptBookService.transferReceiptBooks(
        bookIDs: bookIDs,
        recipientID: recipientID,
        recipientType: recipientType,
      );
      // Refresh the receipt books list for the current holder
      if (_currentReceiptBook?.currentHolderID != null) {
        await fetchReceiptBooksByHolder(_currentReceiptBook!.currentHolderID!);
      } else {
        await fetchAllReceiptBooks();
      }
      if (kDebugMode) print('Transferred ${bookIDs.length} receipt books successfully');
    } catch (e) {
      _errorMessage = 'Failed to transfer receipt books: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
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
    if (kDebugMode) print('ReceiptBookProvider: Validating transfer for books: $bookIDs to $recipientID ($recipientType)');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      await _receiptBookService.validateTransfer(
        bookIDs: bookIDs,
        recipientID: recipientID,
        otpCode: otpCode,
        recipientType: recipientType,
      );
      // Refresh the receipt books list for the recipient
      await fetchReceiptBooksByHolder(recipientID, holderType: recipientType);
      if (kDebugMode) print('Validated transfer for ${bookIDs.length} books successfully');
    } catch (e) {
      _errorMessage = 'Failed to validate transfer: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAllReceiptBookTypes() async {
    if (_receiptBookTypes.isNotEmpty) {
      if (kDebugMode) print('ReceiptBookProvider: All receipt book types already loaded, skipping fetch');
      return;
    }
    if (kDebugMode) print('ReceiptBookProvider: Fetching all receipt book types');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      _receiptBookTypes = await _receiptBookService.getAllReceiptBookTypes();
      if (kDebugMode) print('Fetched ${_receiptBookTypes.length} receipt book types');
    } catch (e) {
      _receiptBookTypes = [];
      _errorMessage = 'Failed to fetch receipt book types: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    if (kDebugMode) print('ReceiptBookProvider: Clearing error message');
    _errorMessage = null;
    notifyListeners();
  }
}