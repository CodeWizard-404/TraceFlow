import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/cookie_manager.dart';
import '../utils/device_utils.dart';

// Manages authentication state and operations for the TraceFlow mobile app.
class AuthProvider with ChangeNotifier {
  User? _user;
  List<String>? _userRoles;
  bool _isLoading = false;
  bool _permissionsLoaded = false;
  String? _userID;
  bool _requires2FA = false;
  String? _errorMessage;
  int _otpTimer = 600; // 10 minutes
  int _resendCooldown = 0; // 60 seconds
  String _otpMethod = 'phone';
  Timer? _otpTimerInstance;
  String? _tempToken; // For password reset
  String? _authTempToken; // For 2FA
  String? _refreshToken; // For 2FA
  int? _tokenExpiry;
  Timer? _refreshTimer;
  String? _deviceIdentifier; // Store deviceIdentifier

  // Getters for state
  String? get deviceIdentifier => _deviceIdentifier;
  User? get user => _user;
  List<String>? get userRoles => _userRoles;
  bool get isLoading => _isLoading;
  bool get permissionsLoaded => _permissionsLoaded;
  String? get errorMessage => _errorMessage;
  int get otpTimer => _otpTimer;
  int get resendCooldown => _resendCooldown;
  String get otpMethod => _otpMethod;
  String? get userID => _userID;
  bool get requires2FA => _requires2FA;
  bool get isSupervisor => _userRoles?.contains('Supervisor') ?? false;
  bool get isAuthenticated => _user != null && !_requires2FA;

  AuthProvider() {
    if (kDebugMode) print('AuthProvider initialized');
    _restoreSession();
    _startProactiveRefreshTimer();
  }

  // Starts a timer to proactively refresh tokens every 14.5 minutes.
  void _startProactiveRefreshTimer() {
    if (kDebugMode) print('Starting proactive refresh timer');
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(minutes: 14, seconds: 30), (timer) async {
      if (_user != null) await _refreshAccessToken();
    });
  }

  // Restores session from stored cookies.
  Future<void> _restoreSession() async {
    if (kDebugMode) print('Restoring session');
    _isLoading = true;
    notifyListeners();
    try {
      _deviceIdentifier = await DeviceUtils.getDeviceIdentifier();
      await CookieManager.loadCookies();
      if (CookieManager.cookies.containsKey('accessToken') && CookieManager.cookies.containsKey('refreshToken')) {
        await _checkAuthStatus();
      } else {
        if (kDebugMode) print('No valid tokens found');
        _errorMessage = 'Please log in to continue.';
      }
    } catch (e) {
      if (kDebugMode) print('Session restoration failed: $e');
      await CookieManager.clearCookies(caller: 'AuthProvider.restoreSession');
      _errorMessage = 'Please log in to continue.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Checks authentication status with the backend.
  Future<void> _checkAuthStatus() async {
    if (kDebugMode) print('Checking auth status');
    try {
      final result = await AuthService.checkAuthStatus();
      if (result.containsKey('user')) {
        _user = User.fromJson(result['user']);
        _tokenExpiry = (result['expiresIn'] != null
            ? DateTime.now().millisecondsSinceEpoch + result['expiresIn']
            : null) as int?;
        await _fetchPermissions();
        if (!_userRoles!.contains('Supervisor')) {
          if (kDebugMode) print('User is not a Supervisor, logging out');
          await logout();
          _errorMessage = 'Access denied: Only Supervisors can log in.';
        }
      } else {
        if (kDebugMode) print('No valid user data');
        await CookieManager.clearCookies(caller: 'AuthProvider.checkAuthStatus');
        _errorMessage = 'Please log in to continue.';
      }
    } catch (e) {
      if (kDebugMode) print('Auth status check failed: $e');
      await CookieManager.clearCookies(caller: 'AuthProvider.checkAuthStatus');
      _errorMessage = 'Please log in to continue.';
      throw e;
    }
  }

  // Fetches user roles and permissions.
  Future<void> _fetchPermissions() async {
    if (_user == null || _permissionsLoaded) return;
    if (kDebugMode) print('Fetching permissions');
    _permissionsLoaded = false;
    try {
      _userRoles = _user!.roles.map((r) => r.name).toList();
      _permissionsLoaded = true;
    } catch (e) {
      if (kDebugMode) print('Failed to fetch permissions: $e');
    } finally {
      _permissionsLoaded = true;
      notifyListeners();
    }
  }

  // Initiates login with identifier and password.
  Future<void> login(String identifier, String password) async {
    if (kDebugMode) print('Logging in with identifier: $identifier');
    _isLoading = true;
    _requires2FA = false;
    _errorMessage = null;
    _deviceIdentifier = await DeviceUtils.getDeviceIdentifier();
    notifyListeners();
    try {
      final result = await AuthService.login(identifier, password, _otpMethod);
      if (result['requires2FA'] == true) {
        _userID = result['userID'];
        _authTempToken = result['tempToken'];
        _refreshToken = result['refreshToken'];
        _requires2FA = true;
        _otpTimer = 600;
        _startOtpTimer();
      } else {
        await _handleSuccessfulLogin(result);
      }
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Verifies 2FA OTP code.
  Future<void> verify2FA(String otpCode, bool trustDevice) async {
    if (_userID == null || _authTempToken == null || _refreshToken == null || _deviceIdentifier == null) {
      _errorMessage = 'Missing authentication data';
      _isLoading = false;
      notifyListeners();
      return;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await AuthService.verify2FA(
        _userID!,
        otpCode,
        trustDevice,
        _authTempToken!,
        _refreshToken!,
        _deviceIdentifier!,
      );
      await _handleSuccessfulLogin(result);
      _requires2FA = false;
      _authTempToken = null;
      _refreshToken = null;
      _deviceIdentifier = null; // Optional: clear after successful login
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Resends 2FA OTP.
  Future<void> resend2FA(String method) async {
    if (_userID == null || _resendCooldown > 0 || _deviceIdentifier == null) return;
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
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Initiates password reset process.
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
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Verifies password reset OTP.
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
      final result = await AuthService.verifyPasswordResetOTP(_userID!, otpCode);
      _tempToken = result['tempToken'];
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Resets password with new password.
  Future<void> resetPassword(String newPassword) async {
    if (_userID == null || _tempToken == null) {
      _errorMessage = 'Missing reset data';
      notifyListeners();
      return;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await AuthService.resetPassword(_userID!, newPassword, _tempToken!);
      _errorMessage = 'Password reset successfully! Please log in.';
      _userID = null;
      _tempToken = null;
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Logs out the user and clears state.
  Future<void> logout() async {
    if (kDebugMode) print('Logging out');
    _otpTimerInstance?.cancel();
    _refreshTimer?.cancel();
    _user = null;
    _userRoles = null;
    _permissionsLoaded = false;
    _userID = null;
    _requires2FA = false;
    _errorMessage = null;
    _tempToken = null;
    _authTempToken = null;
    _refreshToken = null;
    _tokenExpiry = null;
    try {
      await AuthService.logout();
    } catch (e) {
      if (kDebugMode) print('Logout error: $e');
    }
    await CookieManager.clearCookies(caller: 'AuthProvider.logout');
    notifyListeners();
    _startProactiveRefreshTimer();
  }

  // Clears error message.
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  // Starts OTP countdown timer.
  void _startOtpTimer() {
    _otpTimerInstance?.cancel();
    _otpTimerInstance = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_otpTimer > 0) _otpTimer--;
      if (_resendCooldown > 0) _resendCooldown--;
      if (_otpTimer == 0 && _resendCooldown == 0) timer.cancel();
      notifyListeners();
    });
  }

  // Handles successful login response.
  Future<void> _handleSuccessfulLogin(Map<String, dynamic> result) async {
    if (result.containsKey('user')) {
      _user = User.fromJson(result['user']);
      _tokenExpiry = (result['expiresIn'] != null
          ? DateTime.now().millisecondsSinceEpoch + result['expiresIn']
          : null) as int?;
      await CookieManager.saveCookies({
        'accessToken': result['accessToken'],
        'refreshToken': result['refreshToken'],
      });
      await _fetchPermissions();
      if (!_userRoles!.contains('Supervisor')) {
        await logout();
        _errorMessage = 'Access denied: Only Supervisors can log in.';
      }
    } else {
      _errorMessage = 'Invalid login response';
    }
    notifyListeners();
  }

  // Refreshes access token with retry logic.
  Future<void> _refreshAccessToken() async {
    if (!CookieManager.cookies.containsKey('refreshToken')) {
      if (kDebugMode) print('No refresh token');
      await CookieManager.clearCookies(caller: 'AuthProvider.refreshAccessToken');
      _errorMessage = 'Session expired. Please log in again.';
      await logout();
      notifyListeners();
      return;
    }
    const maxRetries = 3;
    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final result = await AuthService.refreshToken();
        _tokenExpiry = (result['expiresIn'] != null
            ? DateTime.now().millisecondsSinceEpoch + result['expiresIn']
            : null) as int?;
        await CookieManager.saveCookies({
          'accessToken': result['accessToken'],
          'refreshToken': result['refreshToken'],
        });
        if (kDebugMode) print('Token refreshed');
        return;
      } catch (e) {
        if (attempt == maxRetries) {
          await CookieManager.clearCookies(caller: 'AuthProvider.refreshAccessToken');
          _errorMessage = 'Session expired. Please log in again.';
          await logout();
          notifyListeners();
        }
        await Future.delayed(const Duration(seconds: 1));
      }
    }
  }
}