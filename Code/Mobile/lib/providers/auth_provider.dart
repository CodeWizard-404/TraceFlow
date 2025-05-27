import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:TraceFlow/models/user.dart';
import 'package:TraceFlow/services/auth_service.dart';
import 'package:TraceFlow/services/cookie_manager.dart';
import 'package:TraceFlow/utils/device_utils.dart';

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
  String? _deviceIdentifier;

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
  bool get isSupervisor => _userRoles?.any((role) => role.toLowerCase() == 'supervisor') ?? false;
  bool get isAuthenticated => _user != null && !_requires2FA;

  AuthProvider() {
    _restoreSession();
    _startProactiveRefreshTimer();
  }

  void _startProactiveRefreshTimer() {
    _refreshTimer?.cancel();
    const refreshInterval = Duration(minutes: 14, seconds: 30);
    _refreshTimer = Timer.periodic(refreshInterval, (_) => _refreshAccessToken());
  }

  Future<void> _restoreSession() async {
    _isLoading = true;
    notifyListeners();
    try {
      _deviceIdentifier = await DeviceUtils.getDeviceIdentifier();
      await CookieManager.loadCookies();
      if (CookieManager.cookies.containsKey('accessToken') &&
          CookieManager.cookies.containsKey('userData')) {
        await _checkAuthStatus();
      }
    } catch (e) {
      _errorMessage = 'Please log in to continue.';
      await CookieManager.clearCookies();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _checkAuthStatus() async {
    try {
      final result = await AuthService.checkAuthStatus();
      _user = User.fromJson(result['user']);
      _tokenExpiry = DateTime.now().millisecondsSinceEpoch + (result['expiresIn'] as int);
      await _fetchPermissions();
      if (kDebugMode) {
        print('After fetchPermissions in checkAuthStatus: isSupervisor=$isSupervisor, userRoles=$_userRoles');
      }
    } catch (e) {
      _errorMessage = 'Session expired. Please log in again.';
      await CookieManager.clearCookies();
      throw Exception(_parseError(e));
    }
  }

  Future<void> _fetchPermissions() async {
    _permissionsLoaded = false;
    try {
      if (_user != null) {
        _userRoles = _user!.roles.map((r) => r.name).toList();
        if (kDebugMode) {
          print('Fetched roles: $_userRoles');
        }
      } else {
        if (kDebugMode) {
          print('No user object available for role fetching');
        }
        _userRoles = [];
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error fetching permissions: $e');
      }
      _userRoles = [];
    } finally {
      _permissionsLoaded = true;
      notifyListeners();
    }
  }

  Future<void> login(String identifier, String password) async {
    _isLoading = true;
    _errorMessage = null;
    _requires2FA = false;
    notifyListeners();
    try {
      _deviceIdentifier = await DeviceUtils.getDeviceIdentifier();
      final result = await AuthService.login(identifier, password, _deviceIdentifier!);
      if (result['requires2FA'] == true) {
        _requires2FA = true;
        _userID = result['userID'];
        _authTempToken = result['tempToken'];
        _refreshToken = result['refreshToken'];
        _otpTimer = 600;
        _otpMethod = result['otpMethod'] ?? 'phone';
        _startOtpTimer();
      } else {
        await _handleSuccessfulLogin(result);
      }
    } catch (e) {
      _errorMessage = _parseError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loginWithKeycloak() async {
    _isLoading = true;
    _errorMessage = null;
    _requires2FA = false;
    notifyListeners();
    try {
      _deviceIdentifier = await DeviceUtils.getDeviceIdentifier();
      final result = await AuthService.initiateKeycloakLogin();
      if (result['requires2FA'] == true) {
        _requires2FA = true;
        _userID = result['userID'];
        _authTempToken = result['tempToken'];
        _refreshToken = result['refreshToken'];
        _otpTimer = 600;
        _otpMethod = result['otpMethod'] ?? 'phone';
        _startOtpTimer();
      } else {
        await _handleSuccessfulLogin(result);
      }
    } catch (e) {
      _errorMessage = _parseError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verify2FA(String otpCode, bool trustDevice) async {
    if (_userID == null ||
        _authTempToken == null ||
        _refreshToken == null ||
        _deviceIdentifier == null) {
      _errorMessage = 'Invalid session. Please try again.';
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
    } catch (e) {
      _errorMessage = _parseError(e);
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
      _errorMessage = _parseError(e);
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
      _otpMethod = result['message']?.contains('email') ?? false ? 'email' : 'phone';
      _startOtpTimer();
    } catch (e) {
      _errorMessage = _parseError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verifyPasswordResetOTP(String otpCode) async {
    if (_userID == null) {
      _errorMessage = 'Invalid session';
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
      _errorMessage = _parseError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> resetPassword(String newPassword) async {
    if (_userID == null || _tempToken == null) {
      _errorMessage = 'Invalid reset data';
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
      _errorMessage = _parseError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
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
      if (kDebugMode) {
        print('Logout error: $e');
      }
    } finally {
      await CookieManager.clearCookies();
      notifyListeners();
      _startProactiveRefreshTimer();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  void _startOtpTimer() {
    _otpTimerInstance?.cancel();
    _otpTimerInstance = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_otpTimer > 0) _otpTimer--;
      if (_resendCooldown > 0) _resendCooldown--;
      if (_otpTimer == 0 && _resendCooldown == 0) timer.cancel();
      notifyListeners();
    });
  }

  Future<void> _handleSuccessfulLogin(Map<String, dynamic> result) async {
    try {
      print('Handling login with user data: ${jsonEncode(result['user'])}');
      _user = User.fromJson(result['user'] ?? {});
      _tokenExpiry = DateTime.now().millisecondsSinceEpoch + (result['expiresIn'] as int);
      await CookieManager.saveCookies({
        'accessToken': result['accessToken'],
        'refreshToken': result['refreshToken'],
        'userData': jsonEncode(result['user']),
      });
    } catch (e, stack) {
      print('Error in handleSuccessfulLogin: $e\n$stack'); // Detailed error
      _user = User(
        userID: result['user']?['userID']?.toString() ?? 'unknown',
        email: result['user']?['email']?.toString() ?? '',
        phone: result['user']?['phone']?.toString() ?? '',
        roles: [],
      );
    }
    await _fetchPermissions();
    print('After fetchPermissions: isSupervisor=$isSupervisor, userRoles=${_user?.roles.map((r) => r.name).toList()}');
    notifyListeners();
  }


  Future<void> _refreshAccessToken() async {
    if (!CookieManager.cookies.containsKey('refreshToken')) {
      _errorMessage = 'Session expired. Please log in again.';
      await logout();
      return;
    }
    try {
      final result = await AuthService.refreshToken();
      _tokenExpiry = DateTime.now().millisecondsSinceEpoch + (result['expiresIn'] as int);
      await CookieManager.saveCookies({
        'accessToken': result['accessToken'],
        'refreshToken': result['refreshToken'],
      });
    } catch (e) {
      _errorMessage = 'Session expired. Please log in again.';
      await logout();
    }
    notifyListeners();
  }

  String _parseError(dynamic error) {
    if (error is http.Response) {
      try {
        final body = jsonDecode(error.body);
        return body['error'] ??
            body['message'] ??
            'An error occurred: ${error.statusCode}';
      } catch (_) {
        return 'An error occurred: ${error.statusCode}';
      }
    } else if (error is Exception) {
      return error.toString().replaceFirst('Exception: ', '');
    }
    return error.toString();
  }
}