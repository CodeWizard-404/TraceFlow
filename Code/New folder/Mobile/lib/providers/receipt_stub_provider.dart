import 'package:flutter/foundation.dart';
import '../models/receipt_stub.dart';
import '../services/auth_service.dart';
import '../services/cookie_manager.dart';
import '../services/receipt_stub_service.dart';

class ReceiptStubProvider with ChangeNotifier {
  final ReceiptStubService _receiptStubService;
  final List<ReceiptStub> _stubs = [];
  bool _isLoading = false;
  String? _errorMessage;

  ReceiptStubProvider({ReceiptStubService? receiptStubService})
      : _receiptStubService = receiptStubService ?? ReceiptStubService();

  List<ReceiptStub> get stubs => _stubs;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> collectStub(List<String> bookIDs) async {
    if (kDebugMode) print('ReceiptStubProvider: Collecting stubs for books: $bookIDs');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      await _receiptStubService.collectStub(bookIDs);
      if (kDebugMode) print('Stubs collected successfully for ${bookIDs.length} books');
    } catch (e) {
      _errorMessage = 'Failed to collect stubs: $e';
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

  Future<void> validateStubCollection(List<String> bookIDs, String otpCode) async {
    if (kDebugMode) print('ReceiptStubProvider: Validating stub collection for books: $bookIDs');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      await _receiptStubService.validateStubCollection(bookIDs, otpCode);
      if (kDebugMode) print('Stubs validated successfully for ${bookIDs.length} books');
    } catch (e) {
      _errorMessage = 'Failed to validate stub collection: $e';
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
    if (kDebugMode) print('ReceiptStubProvider: Clearing error message');
    _errorMessage = null;
    notifyListeners();
  }
}