import 'package:flutter/material.dart';
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

  Future<void> collectStub(String bookID) async {
    if (kDebugMode) print('Collecting stub for book: $bookID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await _receiptStubService.collectStub(bookID);
      if (kDebugMode) print('Stub collected successfully');
    } catch (e) {
      _errorMessage = 'Failed to collect stub: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> validateStubCollection(String bookID, String otpCode) async {
    if (kDebugMode) print('Validating stub collection for book: $bookID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _currentStub = await _receiptStubService.validateStubCollection(bookID, otpCode);
      if (kDebugMode) {
        print(_currentStub != null
            ? 'Stub validated: ${_currentStub!.stubID}'
            : 'No stub found for book: $bookID');
      }
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