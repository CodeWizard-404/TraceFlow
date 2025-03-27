// lib/providers/receipt_stub_provider.dart
import 'package:flutter/foundation.dart';
import '../models/receipt_stub.dart';
import '../services/receipt_stub_service.dart';

class ReceiptStubProvider with ChangeNotifier {
  ReceiptStub? _currentStub;
  bool _isLoading = false;

  ReceiptStub? get currentStub => _currentStub;
  bool get isLoading => _isLoading;

  Future<void> collectStub(String bookID, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      await ReceiptStubService.collectStub(bookID, token);
    } catch (e) {
      throw Exception('Failed to collect stub: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> validateStubCollection(String bookID, String otpCode, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentStub = await ReceiptStubService.validateStubCollection(bookID, otpCode, token);
    } catch (e) {
      throw Exception('Failed to validate stub collection: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}