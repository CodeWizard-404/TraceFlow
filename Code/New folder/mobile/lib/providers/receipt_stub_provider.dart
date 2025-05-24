import 'package:flutter/foundation.dart';
import '../models/receipt_stub.dart';
import '../services/receipt_stub_service.dart';

class ReceiptStubProvider with ChangeNotifier {
  final ReceiptStubService _receiptStubService;
  ReceiptStub? _currentStub;
  bool _isLoading = false;
  String? _errorMessage;

  ReceiptStubProvider({ReceiptStubService? receiptStubService})
      : _receiptStubService = receiptStubService ?? ReceiptStubService();

  ReceiptStub? get currentStub => _currentStub;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> collectStub(List<String> bookIDs) async {
    if (kDebugMode) print('Collecting stubs for books: $bookIDs');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await _receiptStubService.collectStub(bookIDs);
      if (kDebugMode) print('Stubs collected successfully');
    } catch (e) {
      _errorMessage = 'Failed to collect stubs: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> validateStubCollection(List<String> bookIDs, String otpCode) async {
    if (kDebugMode) print('Validating stub collection for books: $bookIDs');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await _receiptStubService.validateStubCollection(bookIDs, otpCode);
      if (kDebugMode) print('Stubs validated successfully');
    } catch (e) {
      _errorMessage = 'Failed to validate stub collection: $e';
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