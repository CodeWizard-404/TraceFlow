import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:device_info_plus/device_info_plus.dart'; // Added
import '../models/user.dart';
import '../services/auth_service.dart';

class AuthProvider with ChangeNotifier {
  String? _token;
  User? _user;
  List<String>? _userRoles;
  List<String>? _effectivePermissions;
  bool _isLoading = false;
  bool _permissionsLoaded = false;
  String? _userID;
  String? _deviceIdentifier;
  bool _requires2FA = false;
  String? _errorMessage;
  int _otpTimer = 600;
  int _resendCooldown = 0;
  String _otpMethod = 'phone';

  String? get token => _token;
  User? get user => _user;
  List<String>? get userRoles => _userRoles;
  List<String>? get effectivePermissions => _effectivePermissions;
  bool get isLoading => _isLoading;
  bool get permissionsLoaded => _permissionsLoaded;
  String? get errorMessage => _errorMessage;
  int get otpTimer => _otpTimer;
  int get resendCooldown => _resendCooldown;
  String get otpMethod => _otpMethod;
  String? get userID => _userID;
  bool get requires2FA => _requires2FA;
  bool get isSupervisor => _userRoles?.contains('Supervisor') ?? false;

  AuthProvider() {
    _loadAuthData();
    _initializeDeviceIdentifier();
  }

  Future<void> _loadAuthData() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    final userJson = prefs.getString('user');
    if (_token != null && userJson != null) {
      _user = User.fromJson(json.decode(userJson));
      await _fetchPermissions();
    }
    notifyListeners();
  }

  Future<void> _initializeDeviceIdentifier() async {
    final deviceInfo = DeviceInfoPlugin();
    String identifier;
    try {
      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        identifier = androidInfo.id; // Unique ID for Android
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        identifier = iosInfo.identifierForVendor ?? 'unknown_ios_device'; // Unique ID for iOS
      } else {
        identifier = 'unknown_device'; // Fallback for other platforms
      }
      _deviceIdentifier = identifier;
    } catch (e) {
      if (kDebugMode) print('Failed to get device identifier: $e');
      _deviceIdentifier = 'unknown_device_${DateTime.now().millisecondsSinceEpoch}'; // Fallback
    }
    notifyListeners();
  }

  Future<void> _fetchPermissions() async {
    if (_user == null || _token == null || _permissionsLoaded) return;
    _permissionsLoaded = false;
    try {
      _userRoles = _user?.roles.map((r) => r.name).toList() ?? [];
      _effectivePermissions = _userRoles!.contains('Supervisor') ? ['view_timesheet'] : [];
      _permissionsLoaded = true;
    } catch (e) {
      if (kDebugMode) print('Failed to fetch permissions: $e');
    } finally {
      _permissionsLoaded = true;
      notifyListeners();
    }
  }

  Future<void> login(String identifier, String password) async {
    if (_deviceIdentifier == null) return;
    _isLoading = true;
    _requires2FA = false;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await AuthService.login(identifier, password, _deviceIdentifier!, _otpMethod);
      if (result.containsKey('requires2FA') && result['requires2FA']) {
        _userID = result['userID'];
        _deviceIdentifier = result['deviceIdentifier'];
        _requires2FA = true;
        _otpTimer = 600;
        _startOtpTimer();
      } else {
        await _handleSuccessfulLogin(result);
      }
    } catch (e) {
      _errorMessage = _parseError(e.toString());
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verify2FA(String otpCode, bool trustDevice) async {
    if (_userID == null || _deviceIdentifier == null) {
      _errorMessage = 'User ID or device identifier missing';
      notifyListeners();
      return;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await AuthService.verify2FA(_userID!, otpCode, _deviceIdentifier!, trustDevice);
      await _handleSuccessfulLogin(result);
      _requires2FA = false;
    } catch (e) {
      _errorMessage = _parseError(e.toString());
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> resend2FA(String method) async {
    if (_userID == null || _resendCooldown > 0) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await AuthService.resend2FA(_userID!, method);
      _otpMethod = method;
      _otpTimer = 600;
      _resendCooldown = 60;
      _errorMessage = result['message'];
      _startOtpTimer();
    } catch (e) {
      _errorMessage = _parseError(e.toString());
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> initiatePasswordReset(String identifier) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await AuthService.initiatePasswordReset(identifier);
      _userID = result['userID'];
      _otpTimer = 600;
      _startOtpTimer();
    } catch (e) {
      _errorMessage = _parseError(e.toString());
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verifyPasswordResetOTP(String otpCode) async {
    if (_userID == null) {
      _errorMessage = 'User ID missing';
      notifyListeners();
      return;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await AuthService.verifyPasswordResetOTP(_userID!, otpCode);
    } catch (e) {
      _errorMessage = _parseError(e.toString());
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> resetPassword(String newPassword) async {
    if (_userID == null) {
      _errorMessage = 'User ID missing';
      notifyListeners();
      return;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await AuthService.resetPassword(_userID!, newPassword);
      _errorMessage = 'Password reset successfully! Please log in.';
      _userID = null;
    } catch (e) {
      _errorMessage = _parseError(e.toString());
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    _userRoles = null;
    _effectivePermissions = null;
    _permissionsLoaded = false;
    _userID = null;
    _requires2FA = false;
    _errorMessage = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  void _startOtpTimer() {
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (_otpTimer > 0) _otpTimer--;
      if (_resendCooldown > 0) _resendCooldown--;
      notifyListeners();
      return _otpTimer > 0 || _resendCooldown > 0;
    });
  }

  Future<void> _handleSuccessfulLogin(Map<String, dynamic> result) async {
    _token = result['token'];
    _user = User.fromJson(result['user']);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', _token!);
    await prefs.setString('user', json.encode(result['user']));
    await _fetchPermissions();
  }

  String _parseError(String error) {
    if (error.contains('Invalid credentials')) return 'Invalid email or password';
    if (error.contains('User not found')) return 'User not found';
    if (error.contains('Invalid or expired OTP')) return 'Invalid or expired OTP';
    if (error.contains('Network Error')) return 'Unable to connect to the server. Check your connection.';
    return 'An error occurred. Please try again.';
  }
}