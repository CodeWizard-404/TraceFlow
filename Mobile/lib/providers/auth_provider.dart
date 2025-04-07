import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

class AuthProvider with ChangeNotifier {
  String? _token;
  User? _user;
  bool _isLoading = false;
  String? _userID; // For 2FA and password reset flows
  bool _requires2FA = false;
  String? _deviceIdentifier;

  String? get token => _token;
  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isSupervisor => _user?.roles.any((role) => role.name == 'Supervisor') ?? false;
  bool get requires2FA => _requires2FA;
  String? get userID => _userID;

  AuthProvider() {
    _loadAuthData();
  }

  Future<void> _loadAuthData() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    final userJson = prefs.getString('user');
    if (_token != null && userJson != null) {
      _user = User.fromJson(json.decode(userJson));
    }
    notifyListeners();
  }

  Future<void> login(String identifier, String password) async {
    _isLoading = true;
    _requires2FA = false;
    notifyListeners();
    try {
      final result = await AuthService.login(identifier, password);
      if (result.containsKey('requires2FA') && result['requires2FA'] == true) {
        _userID = result['userID'];
        _deviceIdentifier = result['deviceIdentifier'];
        _requires2FA = true;
      } else {
        _token = result['token'];
        _user = User.fromJson(result['user']);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', _token!);
        await prefs.setString('user', json.encode(result['user']));
      }
    } catch (e) {
      _token = null;
      _user = null;
      _requires2FA = false;
      throw Exception('Login failed: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verify2FA(String otpCode, bool trustDevice) async {
    if (_userID == null || _deviceIdentifier == null) {
      throw Exception('User ID or device identifier missing');
    }
    _isLoading = true;
    notifyListeners();
    try {
      final result = await AuthService.verify2FA(_userID!, otpCode, trustDevice);
      _token = result['token'];
      _user = User.fromJson(result['user']);
      _requires2FA = false;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', _token!);
      await prefs.setString('user', json.encode(result['user']));
    } catch (e) {
      _token = null;
      throw Exception('2FA verification failed: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> resend2FA() async {
    if (_userID == null) {
      throw Exception('User ID missing');
    }
    _isLoading = true;
    notifyListeners();
    try {
      await AuthService.resend2FA(_userID!);
    } catch (e) {
      throw Exception('Failed to resend 2FA: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> initiatePasswordReset(String identifier) async {
    _isLoading = true;
    notifyListeners();
    try {
      final result = await AuthService.initiatePasswordReset(identifier);
      _userID = result['userID'];
    } catch (e) {
      throw Exception('Failed to initiate password reset: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verifyPasswordResetOTP(String otpCode) async {
    if (_userID == null) {
      throw Exception('User ID missing');
    }
    _isLoading = true;
    notifyListeners();
    try {
      await AuthService.verifyPasswordResetOTP(_userID!, otpCode);
    } catch (e) {
      throw Exception('Failed to verify reset OTP: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> resetPassword(String newPassword) async {
    if (_userID == null) {
      throw Exception('User ID missing');
    }
    _isLoading = true;
    notifyListeners();
    try {
      await AuthService.resetPassword(_userID!, newPassword);
      _userID = null; // Reset flow
    } catch (e) {
      throw Exception('Failed to reset password: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    _userID = null;
    _requires2FA = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
    notifyListeners();
  }
}