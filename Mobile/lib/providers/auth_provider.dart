// lib/providers/auth_provider.dart
import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

class AuthProvider with ChangeNotifier {
  String? _token;
  User? _user;
  bool _isLoading = false;

  String? get token => _token;
  User? get user => _user;
  bool get isLoading => _isLoading;

  Future<void> login(String identifier, String password) async {
    _isLoading = true;
    notifyListeners();
    try {
      final result = await AuthService.login(identifier, password);
      _token = result['token'];
      _user = User.fromJson(result['user']);
    } catch (e) {
      _token = null;
      _user = null;
      throw Exception('Login failed: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verify2FA(String userID, String otpCode) async {
    _isLoading = true;
    notifyListeners();
    try {
      _token = await AuthService.verify2FA(userID, otpCode);
    } catch (e) {
      _token = null;
      throw Exception('2FA verification failed: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> resend2FA(String userID) async {
    _isLoading = true;
    notifyListeners();
    try {
      await AuthService.resend2FA(userID);
    } catch (e) {
      throw Exception('Failed to resend 2FA: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void logout() {
    _token = null;
    _user = null;
    notifyListeners();
  }
}