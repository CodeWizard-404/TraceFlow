import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/cookie_manager.dart';
import 'dart:async';

class AuthProvider with ChangeNotifier {
  User? _user;
  List<String>? _userRoles;
  bool _isLoading = false;
  bool _permissionsLoaded = false;
  String? _userID;
  bool _requires2FA = false;
  String? _errorMessage;
  int _otpTimer = 600;
  int _resendCooldown = 0;
  String _otpMethod = 'phone';
  Timer? _otpTimerInstance;
  String? _tempToken;
  String? _authTempToken;
  String? _refreshToken;
  int? _tokenExpiry;
  Timer? _refreshTimer;

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

  void _startProactiveRefreshTimer() {
    if (kDebugMode) print('Starting proactive refresh timer (every 14.5 minutes)');
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(minutes: 14, seconds: 30), (timer) async {
      if (kDebugMode) print('Proactive refresh triggered');
      await _refreshAccessToken();
    });
  }

  Future<void> _restoreSession() async {
    if (kDebugMode) print('Restoring session');
    _isLoading = true;
    notifyListeners();
    try {
      await CookieManager.loadCookies();
      if (CookieManager.cookies.containsKey('accessToken') && CookieManager.cookies.containsKey('refreshToken')) {
        await _checkAuthStatus();
      } else {
        if (kDebugMode) print('No valid tokens found, clearing cookies');
        await CookieManager.clearCookies(caller: 'AuthProvider.restoreSession');
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

  Future<void> _checkAuthStatus() async {
    if (kDebugMode) print('Checking auth status, cookies: ${CookieManager.cookies}');
    try {
      final result = await AuthService.checkAuthStatus();
      if (kDebugMode) print('Auth status result: $result');
      if (result.containsKey('user')) {
        _user = User.fromJson(result['user']);
        _tokenExpiry = (result['expiresIn'] != null
            ? DateTime.now().millisecondsSinceEpoch + result['expiresIn']
            : null) as int?;
        await _fetchPermissions();
        if (kDebugMode) print('Session restored, user: ${_user?.userID}, roles: ${_user?.roles}');
      } else {
        if (kDebugMode) print('No valid user data in auth status response');
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

  Future<void> _fetchPermissions() async {
    if (_user == null || _permissionsLoaded) return;
    if (kDebugMode) print('Fetching permissions');
    _permissionsLoaded = false;
    try {
      _userRoles = _user?.roles.map((r) => r.name).toList() ?? [];
      if (kDebugMode) print('User roles: $_userRoles');
      _permissionsLoaded = true;
    } catch (e) {
      if (kDebugMode) print('Failed to fetch permissions: $e');
    } finally {
      _permissionsLoaded = true;
    }
    notifyListeners();
  }

  Future<void> login(String identifier, String password) async {
    if (kDebugMode) print('Starting login with identifier: $identifier');
    _isLoading = true;
    _requires2FA = false;
    _errorMessage = null;
    try {
      final result = await AuthService.login(identifier, password, _otpMethod);
      if (kDebugMode) print('Login result: $result');
      if (result.containsKey('requires2FA') && result['requires2FA']) {
        _userID = result['userID'];
        _authTempToken = result['tempToken'];
        _refreshToken = result['refreshToken'];
        _requires2FA = true;
        _otpTimer = 600;
        _startOtpTimer();
        if (kDebugMode) print('2FA required, userID: $_userID, tempToken: $_authTempToken');
      } else {
        if (kDebugMode) print('Handling successful login');
        await _handleSuccessfulLogin(result);
      }
    } catch (e) {
      if (kDebugMode) print('Login error: $e');
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      if (kDebugMode) print('Login completed, isLoading: $_isLoading, error: $_errorMessage, requires2FA: $_requires2FA');
      notifyListeners();
    }
  }

  Future<void> verify2FA(String otpCode, bool trustDevice) async {
    if (_userID == null || _authTempToken == null || _refreshToken == null) {
      _errorMessage = 'Missing required authentication data';
      if (kDebugMode) print('Verify2FA failed: $_errorMessage');
      _isLoading = false;
      notifyListeners();
      return;
    }
    _isLoading = true;
    _errorMessage = null;
    try {
      final result = await AuthService.verify2FA(
        _userID!,
        otpCode,
        trustDevice,
        _authTempToken!,
        _refreshToken!,
      );
      if (kDebugMode) print('Verify2FA result: $result');
      await _handleSuccessfulLogin(result);
      _requires2FA = false;
      _authTempToken = null;
      _refreshToken = null;
    } catch (e) {
      if (kDebugMode) print('Verify2FA error: $e');
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> resend2FA(String method) async {
    if (_userID == null || _resendCooldown > 0) {
      if (kDebugMode) print('Resend2FA blocked: userID=$_userID, cooldown=$_resendCooldown');
      return;
    }
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
      if (kDebugMode) print('Resend2FA successful: $result');
    } catch (e) {
      if (kDebugMode) print('Resend2FA error: $e');
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
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
      if (kDebugMode) print('Password reset initiated, userID: $_userID');
    } catch (e) {
      if (kDebugMode) print('InitiatePasswordReset error: $e');
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verifyPasswordResetOTP(String otpCode) async {
    if (_userID == null) {
      _errorMessage = 'User ID missing';
      if (kDebugMode) print('VerifyPasswordResetOTP failed: $_errorMessage');
      notifyListeners();
      return;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await AuthService.verifyPasswordResetOTP(_userID!, otpCode);
      _tempToken = result['tempToken'];
      if (kDebugMode) print('Password reset OTP verified, tempToken: $_tempToken');
    } catch (e) {
      if (kDebugMode) print('VerifyPasswordResetOTP error: $e');
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> resetPassword(String newPassword) async {
    if (_userID == null || _tempToken == null) {
      _errorMessage = 'User ID or temporary token missing';
      if (kDebugMode) print('ResetPassword failed: $_errorMessage');
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
      if (kDebugMode) print('Password reset successful');
    } catch (e) {
      if (kDebugMode) print('ResetPassword error: $e');
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

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
    notifyListeners();
    _startProactiveRefreshTimer(); // Restart timer after logout
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  void _startOtpTimer() {
    if (kDebugMode) print('Starting OTP timer');
    _otpTimerInstance?.cancel();
    _otpTimerInstance = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_otpTimer > 0) _otpTimer--;
      if (_resendCooldown > 0) _resendCooldown--;
      if (_otpTimer == 0 && _resendCooldown == 0) {
        timer.cancel();
        if (kDebugMode) print('OTP timer stopped');
      }
      notifyListeners();
    });
  }

  Future<void> _handleSuccessfulLogin(Map<String, dynamic> result) async {
    if (kDebugMode) print('Handling successful login: $result');
    if (result.containsKey('user')) {
      _user = User.fromJson(result['user']);
      _tokenExpiry = (result['expiresIn'] != null
          ? DateTime.now().millisecondsSinceEpoch + result['expiresIn']
          : null) as int?;
      await _fetchPermissions();
      if (!_userRoles!.contains('Supervisor')) {
        if (kDebugMode) print('User lacks Supervisor role, logging out');
        await logout();
        _errorMessage = 'Access denied: Only Supervisors can log in.';
        return;
      }
    } else {
      if (kDebugMode) print('No user data in login result');
    }
    notifyListeners();
  }

  Future<void> _refreshAccessToken() async {
    if (kDebugMode) print('Refreshing access token');
    if (!CookieManager.cookies.containsKey('refreshToken')) {
      if (kDebugMode) print('No refresh token available, skipping refresh');
      await CookieManager.clearCookies(caller: 'AuthProvider.refreshAccessToken');
      _errorMessage = 'Please log in to continue.';
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
        if (kDebugMode) print('Token refreshed, new expiry: $_tokenExpiry');
        return;
      } catch (e) {
        if (kDebugMode) print('Token refresh attempt $attempt failed: $e');
        if (attempt == maxRetries) {
          if (kDebugMode) print('Max refresh attempts reached, logging out');
          await CookieManager.clearCookies(caller: 'AuthProvider.refreshAccessToken');
          _errorMessage = 'Session expired. Please log in again.';
          await logout();
          notifyListeners();
          return;
        }
        await Future.delayed(Duration(seconds: 1));
      }
    }
  }
}