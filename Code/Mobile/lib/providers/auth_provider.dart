import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:TraceFlow/models/user.dart';
import 'package:TraceFlow/services/auth_service.dart';
import 'package:TraceFlow/services/cookie_manager.dart';
import 'package:TraceFlow/utils/device_utils.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import '../models/role.dart';
import '../services/http_client.dart';
import '../utils/constants.dart';

class AuthProvider with ChangeNotifier {
  User? _user;
  List<String>? _userRoles;
  List<String>? _permissions;
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
  bool get isSupervisor {
    final isSupervisor = _userRoles?.any((role) => role.toLowerCase() == 'supervisor') ?? false;
    if (kDebugMode) print('isSupervisor evaluated: $isSupervisor, roles: $_userRoles');
    return isSupervisor;
  }
  bool get isAuthenticated => _user != null && !_requires2FA;

  AuthProvider() {
    _restoreSession();
  }

  void _startProactiveRefreshTimer() {
    _refreshTimer?.cancel();
    if (_tokenExpiry == null || _refreshToken == null) return;
    final now = DateTime.now().millisecondsSinceEpoch;
    final timeToExpiry = (_tokenExpiry! - now - 30000) / 1000; // 30s buffer
    if (timeToExpiry <= 0) {
      _refreshAccessToken();
      return;
    }
    _refreshTimer = Timer(Duration(seconds: timeToExpiry.toInt()), () async {
      if (_refreshToken != null) {
        await _refreshAccessToken();
        _startProactiveRefreshTimer(); // Restart timer after refresh
      } else {
        if (kDebugMode) print('No refresh token available, stopping refresh timer');
        _refreshTimer?.cancel();
      }
    });
  }

  Future<bool> _isTokenExpired() async {
    if (_tokenExpiry == null) return true;
    final now = DateTime.now().millisecondsSinceEpoch;
    return now >= _tokenExpiry! - 30000; // 30s buffer
  }

  Future<void> _restoreSession() async {
    _isLoading = true;
    notifyListeners();
    try {
      _deviceIdentifier = await DeviceUtils.getDeviceIdentifier();
      await CookieManager.loadCookies();
      if (CookieManager.cookies.containsKey('accessToken') &&
          CookieManager.cookies.containsKey('refreshToken')) {
        _refreshToken = CookieManager.cookies['refreshToken'];
        if (await _isTokenExpired()) {
          await _refreshAccessToken();
        }
        await _checkAuthStatus();
        _startProactiveRefreshTimer();
      } else {
        _errorMessage = 'Please log in to continue.';
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
      if (!isSupervisor) {
        throw Exception('Access denied: Supervisor role required');
      }
    } catch (e) {
      _errorMessage = _parseError(e);
      await CookieManager.clearCookies();
      throw Exception(_errorMessage);
    }
  }

  Future<void> _fetchPermissions() async {
    _permissionsLoaded = false;
    if (kDebugMode) print('Starting permissions fetch for user: ${_user?.userID}');
    notifyListeners();
    try {
      if (_user != null) {
        final success = await _loadPermissionsWithRetry(_user!.userID);
        if (!success) {
          if (kDebugMode) print('Permissions load failed, triggering logout');
          await logout();
          _errorMessage = 'Failed to load permissions. Please log in again.';
        } else {
          if (kDebugMode) print('Permissions loaded successfully: $_permissions');
        }
      } else {
        if (kDebugMode) print('No user, skipping permissions fetch');
      }
    } catch (e) {
      if (kDebugMode) print('Permissions fetch error: $e');
      _permissions = [];
      _errorMessage = 'Error fetching permissions: $e';
    } finally {
      _permissionsLoaded = true;
      if (kDebugMode) print('Permissions fetch complete, isSupervisor: $isSupervisor');
      notifyListeners();
    }
  }

  Future<bool> _loadPermissionsWithRetry(String userID) async {
    const maxRetries = 2;
    int attempt = 0;
    while (attempt < maxRetries) {
      try {
        final response = await CustomHttpClient.get(
          Uri.parse('$baseUrl/permissions/effective/$userID'),
          headers: CookieManager.getHeaders(),
        );
        if (response.statusCode == 200) {
          final permissions = jsonDecode(response.body);
          _permissions = (permissions as List)
              .map((p) => p['name']?.toString())
              .where((name) => name != null)
              .cast<String>()
              .toList();
          if (kDebugMode) print('Permissions loaded: $_permissions');
          return true;
        } else {
          if (kDebugMode) print('Permissions fetch failed with status: ${response.statusCode}');
          return false;
        }
      } catch (e) {
        if (kDebugMode) print('Permissions fetch error: $e');
        if (attempt >= maxRetries - 1) return false;
      }
      attempt++;
    }
    return false;
  }

  Future<void> login(String identifier, String password) async {
    _isLoading = true;
    _errorMessage = null;
    _requires2FA = false;
    notifyListeners();
    try {
      _deviceIdentifier = await DeviceUtils.getDeviceIdentifier();
      final result = await AuthService.login(
        identifier,
        password,
        _deviceIdentifier!,
      );
      _refreshToken = result['refreshToken'] ?? '';
      if (kDebugMode) print('Login result: ${jsonEncode(result)}');
      if (result['requires2FA'] == true) {
        _requires2FA = true;
        _userID = result['userID'];
        _authTempToken = result['tempToken'];
        _otpTimer = 600;
        _otpMethod = result['otpMethod'] ?? 'phone';
        _startotpTimer();
      } else {
        await _handleSuccessfulLogin(result);
        _startProactiveRefreshTimer();
        if (kDebugMode) print('After login, isSupervisor: $isSupervisor');
        if (!isSupervisor) {
          if (kDebugMode) print('Supervisor role not found, logging out');
          await logout();
          throw Exception('Access denied: Supervisor role required');
        }
      }
    } catch (e) {
      if (kDebugMode) print('Login error: $e');
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
      _refreshToken = result['refreshToken'] ?? '';
      if (result['requires2FA'] == true) {
        _requires2FA = true;
        _userID = result['userID'];
        _authTempToken = result['tempToken'];
        _otpTimer = 600;
        _otpMethod = result['otpMethod'] ?? 'phone';
        _startotpTimer();
      } else {
        await _handleSuccessfulLogin(result);
        _startProactiveRefreshTimer();
        if (!isSupervisor) {
          await logout();
          throw Exception('Access denied: Supervisor role required');
        }
      }
    } catch (e) {
      _errorMessage = _parseError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loginWithGoogle() async {
    _isLoading = true;
    _errorMessage = null;
    _requires2FA = false;
    notifyListeners();
    try {
      _deviceIdentifier = await DeviceUtils.getDeviceIdentifier();
      final result = await AuthService.initiateGoogleLogin();
      _refreshToken = result['refreshToken'] ?? '';
      if (result['requires2FA'] == true) {
        _requires2FA = true;
        _userID = result['userID'];
        _authTempToken = result['tempToken'];
        _otpTimer = 600;
        _otpMethod = result['otpMethod'] ?? 'phone';
        _startotpTimer();
      } else {
        await _handleSuccessfulLogin(result);
        _startProactiveRefreshTimer();
        if (!isSupervisor) {
          await logout();
          throw Exception('Access denied: Supervisor role required');
        }
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
      _refreshToken = result['refreshToken'] ?? '';
      await _handleSuccessfulLogin(result);
      _requires2FA = false;
      _startProactiveRefreshTimer();
      if (!isSupervisor) {
        await logout();
        throw Exception('Access denied: Supervisor role required');
      }
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
      _errorMessage = result['message'] ?? 'OTP resent successfully';
      _startotpTimer();
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
      _otpMethod =
      result['message']?.contains('email') ?? false ? 'email' : 'phone';
      _startotpTimer();
      _errorMessage = result['message'] ?? 'Password reset initiated';
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
      final result = await AuthService.verifyPasswordResetOTP(
        _userID!,
        otpCode,
      );
      _tempToken = result['tempToken'];
      _errorMessage = 'OTP verified successfully';
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
    if (kDebugMode) print('Logout triggered, current user: ${_user?.userID}, isSupervisor: $isSupervisor');
    _otpTimerInstance?.cancel();
    _refreshTimer?.cancel();
    _isLoading = true;
    notifyListeners();
    try {
      await AuthService.logout();
    } catch (e) {
      if (kDebugMode) print('Logout error: $e');
    } finally {
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
      await CookieManager.clearCookies();
      _isLoading = false;
      if (kDebugMode) print('Logout completed');
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  void _startotpTimer() {
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
      if (kDebugMode) print('Handling successful login with result: ${jsonEncode(result)}');
      if (result['user'] != null) {
        if (kDebugMode) print('Parsing user from response: ${result['user']}');
        _user = User.fromJson(result['user']);
        _userRoles = _user!.roles
            ?.map((role) => role.name)
            .where((name) => name != null)
            .cast<String>()
            .toList() ??
            [];
        if (kDebugMode) print('User parsed: ${_user!.userID}, ${_user!.email}, Roles: $_userRoles');
      } else {
        if (kDebugMode) print('Warning: user is null in login response, decoding token');
        final decodedToken = JwtDecoder.decode(result['accessToken']);
        if (kDebugMode) print('Decoded token: ${jsonEncode(decodedToken)}');
        final fullName = decodedToken['name']?.toString() ?? '';
        final nameParts = fullName.split(' ');
        final firstName = nameParts.isNotEmpty ? nameParts[0] : null;
        final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : null;
        final email = decodedToken['email']?.toString() ??
            decodedToken['preferred_username']?.toString() ??
            'unknown@example.com';
        final userID = decodedToken['sub']?.toString() ?? 'unknown';
        final roles = (decodedToken['realm_access']?['roles'] as List<dynamic>? ?? [])
            .where((r) => r != null)
            .map((r) => Role(
          roleID: r.toString(),
          name: r.toString(),
          description: null,
          permissions: [],
        ))
            .toList();
        _user = User(
          userID: userID,
          firstName: firstName,
          lastName: lastName,
          email: email,
          phone: null,
          roles: roles,
        );
        _userRoles = roles.map((role) => role.name).where((name) => name != null).cast<String>().toList();
        if (kDebugMode) print('User from token: $userID, $email, Roles: $_userRoles');
      }
      _tokenExpiry = (result['expiresIn'] != null
          ? DateTime.now().millisecondsSinceEpoch + result['expiresIn']
          : null) as int?;
      await _fetchPermissions();
      if (kDebugMode) print('After permissions fetch, isSupervisor: $isSupervisor, roles: $_userRoles');
    } catch (e) {
      if (kDebugMode) print('Error handling login: $e');
      _errorMessage = 'Failed to process login: $e';
      rethrow;
    }
  }

  Future<void> _refreshAccessToken() async {
    if (_refreshToken == null) {
      await logout();
      _errorMessage = 'Session expired. Please log in again.';
      notifyListeners();
      return;
    }
    try {
      final result = await AuthService.refreshToken(_refreshToken!);
      _refreshToken = result['refreshToken'] ?? _refreshToken;
      _tokenExpiry = (result['expiresIn'] != null
          ? DateTime.now().millisecondsSinceEpoch + result['expiresIn']
          : null) as int?;
      if (kDebugMode) print('Token refreshed successfully, new expiry: $_tokenExpiry');
    } catch (e) {
      if (kDebugMode) print('Token refresh failed: $e');
      await logout();
      _errorMessage = 'Session expired. Please log in again.';
      notifyListeners();
    }
  }

  String _parseError(dynamic error) {
    if (error is Exception) {
      final message = error.toString().replaceFirst('Exception: ', '');
      if (message.contains('401')) {
        return 'Authentication failed. Please log in again.';
      } else if (message.contains('403')) {
        return 'Access denied. Please contact support.';
      } else if (message.contains('429')) {
        return 'Too many attempts. Please try again later.';
      } else if (message.contains('400')) {
        return 'Invalid request. Please check your input.';
      } else if (message.contains('500')) {
        return 'Server error. Please try again later.';
      }
      return message;
    }
    return error.toString();
  }

  @override
  void dispose() {
    _otpTimerInstance?.cancel();
    _refreshTimer?.cancel();
    super.dispose();
  }
}