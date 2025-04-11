import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import 'dart:async';

class AuthProvider with ChangeNotifier {
  String? _token;
  String? _refreshToken;
  String? _tempToken;
  int? _expiresIn;
  User? _user;
  List<String>? _userRoles;
  bool _isLoading = false;
  bool _permissionsLoaded = false;
  String? _userID;
  String? _deviceIdentifier;
  bool _requires2FA = false;
  String? _errorMessage;
  int _otpTimer = 600;
  int _resendCooldown = 0;
  String _otpMethod = 'phone';
  Timer? _refreshTimer;
  Timer? _otpTimerInstance; // Added to manage OTP timer

  String? get token => _token;
  String? get refreshToken => _refreshToken;
  String? get tempToken => _tempToken;
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

  AuthProvider() {
    if (kDebugMode) print('AuthProvider initialized');
    _loadAuthData();
    _initializeDeviceIdentifier();
  }

  Future<void> _loadAuthData() async {
    if (kDebugMode) print('Loading auth data');
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('accessToken');
    _refreshToken = prefs.getString('refreshToken');
    _tempToken = prefs.getString('tempToken');
    _expiresIn = prefs.getInt('expiresIn');
    final userJson = prefs.getString('user');
    if (_token != null && userJson != null) {
      _user = User.fromJson(json.decode(userJson));
      await _fetchPermissions();
      if (_refreshToken != null && _expiresIn != null) {
        _scheduleTokenRefresh();
      }
    }
    notifyListeners();
  }

  Future<void> _initializeDeviceIdentifier() async {
    if (kDebugMode) print('Initializing device identifier');
    final deviceInfo = DeviceInfoPlugin();
    String identifier;
    try {
      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        identifier = androidInfo.id;
        if (kDebugMode) print('Android device ID: $identifier');
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        identifier = iosInfo.identifierForVendor ?? 'unknown_ios_device';
        if (kDebugMode) print('iOS device ID: $identifier');
      } else {
        identifier = 'unknown_device';
        if (kDebugMode) print('Fallback device ID: $identifier');
      }
      _deviceIdentifier = identifier;
    } catch (e) {
      if (kDebugMode) print('Failed to get device identifier: $e');
      _deviceIdentifier = 'unknown_device_${DateTime.now().millisecondsSinceEpoch}';
    }
    if (kDebugMode) print('Device identifier set to: $_deviceIdentifier');
    notifyListeners();
  }

  Future<void> _fetchPermissions() async {
    if (_user == null || _token == null || _permissionsLoaded) return;
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

  Future<void> _scheduleTokenRefresh() async {
    _refreshTimer?.cancel();
    if (_expiresIn == null || _refreshToken == null) return;
    if (kDebugMode) print('Scheduling token refresh in ${_expiresIn! - 600} seconds');
    final bufferTime = 600;
    final duration = Duration(seconds: _expiresIn! - bufferTime);
    _refreshTimer = Timer(duration, () async {
      try {
        final result = await AuthService.refreshToken(_refreshToken!);
        _token = result['accessToken'];
        _refreshToken = result['refreshToken'];
        _expiresIn = result['expiresIn'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('accessToken', _token!);
        await prefs.setString('refreshToken', _refreshToken!);
        await prefs.setInt('expiresIn', _expiresIn!);
        _scheduleTokenRefresh();
        if (kDebugMode) print('Token refreshed successfully');
      } catch (e) {
        if (kDebugMode) print('Scheduled refresh failed: $e');
        await logout();
      }
      notifyListeners();
    });
  }

  Future<void> login(String identifier, String password) async {
    if (kDebugMode) print('Starting login with identifier: $identifier, device: $_deviceIdentifier');
    if (_deviceIdentifier == null) {
      if (kDebugMode) print('Device identifier is null, cannot proceed');
      _errorMessage = 'Device identifier not initialized. Please try again.';
      _isLoading = false;
      notifyListeners();
      return;
    }
    _isLoading = true;
    _requires2FA = false;
    _errorMessage = null;
    try {
      if (kDebugMode) print('Calling AuthService.login');
      final result = await AuthService.login(identifier, password, _deviceIdentifier!, _otpMethod);
      if (kDebugMode) print('Login result: $result');
      if (result.containsKey('requires2FA') && result['requires2FA']) {
        _userID = result['userID'];
        _deviceIdentifier = result['deviceIdentifier'];
        _tempToken = result['tempToken'];
        _refreshToken = result['refreshToken'];
        _requires2FA = true;
        _otpTimer = 600;
        _startOtpTimer();
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('tempToken', _tempToken!);
        await prefs.setString('refreshToken', _refreshToken!);
        if (kDebugMode) print('2FA required, userID: $_userID, tempToken: $_tempToken');
      } else {
        if (kDebugMode) print('Handling successful login');
        await _handleSuccessfulLogin(result);
      }
    } catch (e) {
      if (kDebugMode) print('Login error: $e');
      _errorMessage = _parseError(e.toString());
    } finally {
      _isLoading = false;
      if (kDebugMode) print('Login completed, isLoading: $_isLoading, error: $_errorMessage, requires2FA: $_requires2FA');
      notifyListeners();
    }
  }

  Future<void> verify2FA(String otpCode, bool trustDevice) async {
    if (_userID == null || _deviceIdentifier == null || _tempToken == null || _refreshToken == null) {
      _errorMessage = 'Missing required authentication data';
      if (kDebugMode) print('Verify2FA failed: $_errorMessage');
      _isLoading = false;
      notifyListeners();
      return;
    }
    _isLoading = true;
    _errorMessage = null;
    try {
      if (kDebugMode) print('Calling AuthService.verify2FA with userID: $_userID, tempToken: $_tempToken');
      final result = await AuthService.verify2FA(_userID!, otpCode, _deviceIdentifier!, trustDevice, _tempToken!, _refreshToken!);
      if (kDebugMode) print('Verify2FA result: $result');
      await _handleSuccessfulLogin(result);
      _requires2FA = false;
      _tempToken = null;
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('tempToken');
    } catch (e) {
      if (kDebugMode) print('Verify2FA error: $e');
      _errorMessage = _parseError(e.toString());
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
      if (kDebugMode) print('Calling AuthService.resend2FA with method: $method');
      final result = await AuthService.resend2FA(_userID!, method);
      _otpMethod = method;
      _otpTimer = 600;
      _resendCooldown = 60;
      _errorMessage = result['message'];
      _startOtpTimer();
      if (kDebugMode) print('Resend2FA successful: $result');
    } catch (e) {
      if (kDebugMode) print('Resend2FA error: $e');
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
      if (kDebugMode) print('Calling AuthService.initiatePasswordReset');
      final result = await AuthService.initiatePasswordReset(identifier);
      _userID = result['userID'];
      _otpTimer = 600;
      _startOtpTimer();
      if (kDebugMode) print('Password reset initiated, userID: $_userID');
    } catch (e) {
      if (kDebugMode) print('InitiatePasswordReset error: $e');
      _errorMessage = _parseError(e.toString());
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
      if (kDebugMode) print('Calling AuthService.verifyPasswordResetOTP');
      await AuthService.verifyPasswordResetOTP(_userID!, otpCode);
      if (kDebugMode) print('Password reset OTP verified');
    } catch (e) {
      if (kDebugMode) print('VerifyPasswordResetOTP error: $e');
      _errorMessage = _parseError(e.toString());
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> resetPassword(String newPassword) async {
    if (_userID == null) {
      _errorMessage = 'User ID missing';
      if (kDebugMode) print('ResetPassword failed: $_errorMessage');
      notifyListeners();
      return;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (kDebugMode) print('Calling AuthService.resetPassword');
      await AuthService.resetPassword(_userID!, newPassword);
      _errorMessage = 'Password reset successfully! Please log in.';
      _userID = null;
      if (kDebugMode) print('Password reset successful');
    } catch (e) {
      if (kDebugMode) print('ResetPassword error: $e');
      _errorMessage = _parseError(e.toString());
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    if (kDebugMode) print('Logging out');
    _refreshTimer?.cancel();
    _otpTimerInstance?.cancel(); // Cancel OTP timer
    _token = null;
    _refreshToken = null;
    _tempToken = null;
    _expiresIn = null;
    _user = null;
    _userRoles = null;
    _permissionsLoaded = false;
    _userID = null;
    _requires2FA = false;
    _errorMessage = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accessToken');
    await prefs.remove('refreshToken');
    await prefs.remove('tempToken');
    await prefs.remove('expiresIn');
    await prefs.remove('token');
    await prefs.remove('user');
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  void _startOtpTimer() {
    if (kDebugMode) print('Starting OTP timer');
    _otpTimerInstance?.cancel(); // Cancel any existing timer
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
    _token = result['token'];
    _refreshToken = result['refreshToken'];
    _expiresIn = result['expiresIn'];
    _user = User.fromJson(result['user']);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', _token!);
    await prefs.setString('refreshToken', _refreshToken!);
    await prefs.setInt('expiresIn', _expiresIn!);
    await prefs.setString('user', json.encode(result['user']));
    await _fetchPermissions();
    _scheduleTokenRefresh();
    notifyListeners();
  }

  String _parseError(String error) {
    if (kDebugMode) print('Parsing error: $error');
    if (error.contains('Invalid credentials')) return 'Invalid email or password';
    if (error.contains('User not found')) return 'User not found';
    if (error.contains('Invalid or expired OTP')) return 'Invalid or expired OTP';
    if (error.contains('Network Error')) return 'Unable to connect to the server. Check your connection.';
    if (error.contains('temp token, and refresh token are required')) return 'Authentication data missing. Please log in again.';
    return 'An error occurred. Please try again.';
  }
}