import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

class AuthProvider with ChangeNotifier {
  String? _token;
  User? _user;
  bool _isLoading = false;

  String? get token => _token;
  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isSupervisor => _user?.roles.any((role) => role.name == 'Supervisor') ?? false;

  AuthProvider() {
    _loadAuthData(); // Load saved data on initialization
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
    notifyListeners();
    try {
      final result = await AuthService.login(identifier, password);
      _token = result['token'];
      _user = User.fromJson(result['user']);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', _token!);
      await prefs.setString('user', json.encode(result['user'])); // Save user data
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
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', _token!);
      // Note: We don’t update _user here since verify2FA doesn’t return user data
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

  Future<void> logout() async {
    _token = null;
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
    notifyListeners();
  }
}