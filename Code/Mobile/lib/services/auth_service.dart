import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:google_sign_in/google_sign_in.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import '../utils/constants.dart';
import './cookie_manager.dart';
import './http_client.dart';

class AuthService {
  static Future<Map<String, dynamic>> initiateKeycloakLogin() async {
    return initiateGoogleLogin();
  }

  static Future<Map<String, dynamic>> initiateGoogleLogin() async {
    try {
      final googleSignIn = GoogleSignIn(
        serverClientId: googleClientIdWeb,
        scopes: ['email', 'profile', 'openid'],
      );

      final googleUser = await googleSignIn.signIn();
      if (googleUser == null) {
        throw Exception('Google Sign-In cancelled');
      }

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;
      if (idToken == null) {
        throw Exception('Failed to retrieve ID token from Google');
      }
      if (kDebugMode) {
        print('Google ID Token: $idToken');
      }

      final tokenResponse = await http.post(
        Uri.parse('$baseUrl/auth/google'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'id_token': idToken}),
      );

      if (tokenResponse.statusCode != 200) {
        if (kDebugMode) {
          print('Login failed: ${tokenResponse.body}');
        }
        throw Exception(
            'Failed to log in: ${jsonDecode(tokenResponse.body)['error'] ?? tokenResponse.body}');
      }

      final tokens = jsonDecode(tokenResponse.body);
      if (kDebugMode) {
        print('Backend response: ${jsonEncode(tokens)}');
      }
      final accessToken = tokens['accessToken'] as String;
      final refreshToken = tokens['refreshToken'] as String;
      await CookieManager.saveCookies({
        'accessToken': accessToken,
        'refreshToken': refreshToken,
      });

      await CookieManager.extractCookies(tokenResponse);

      final userResponse = await CustomHttpClient.get(
        Uri.parse('$baseUrl/users/profile'),
      );
      if (userResponse.statusCode != 200) {
        throw Exception('Failed to fetch user data: ${userResponse.body}');
      }

      final userData = jsonDecode(userResponse.body);
      _ensureRoles(userData, accessToken);

      final requires2FA = await _check2FARequired();
      if (requires2FA) {
        return {
          'userID': userData['user']?['userID']?.toString(),
          'requires2FA': true,
          'tempToken': accessToken,
          'refreshToken': refreshToken,
          'expiresIn': tokens['expiresIn'] ?? 900000,
          'otpMethod': 'phone',
        };
      }

      return {
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'expiresIn': tokens['expiresIn'] ?? 900000,
        'user': userData['user'],
      };
    } catch (e) {
      if (kDebugMode) {
        print('Google login error: $e');
      }
      throw Exception(_parseError(e));
    }
  }

  static Future<bool> _check2FARequired() async {
    try {
      final response = await CustomHttpClient.get(
        Uri.parse('$baseUrl/auth/check-2fa'),
      );
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        return result['requires2FA'] as bool? ?? false;
      }
      throw Exception('Failed to check 2FA requirement');
    } catch (e) {
      throw Exception(_parseError(e));
    }
  }

  static Future<Map<String, dynamic>> checkAuthStatus() async {
    try {
      final response = await CustomHttpClient.get(Uri.parse('$baseUrl/test'));
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (kDebugMode) print('Check auth response: $result');
        // Extract user data from the nested 'user' object
        final userDataRaw = result['user'] as Map<String, dynamic>? ?? {};
        final userData = {
          'userID': userDataRaw['userID']?.toString() ??
              result['userID']?.toString() ??
              'unknown',
          'email': userDataRaw['email']?.toString() ??
              result['email']?.toString() ??
              'unknown@example.com',
          'roles': userDataRaw['roles'] ??
              result['roles'] ??
              [],
        };
        final accessToken = CookieManager.cookies['accessToken'];
        if (accessToken != null) _ensureRoles(userData, accessToken);
        return {
          'user': userData,
          'expiresIn': result['expiresIn'] ?? 900000,
        };
      }
      throw Exception(_parseError(response));
    } catch (e) {
      if (kDebugMode) print('Check auth error: $e');
      throw Exception(_parseError(e));
    }
  }

  static Future<Map<String, dynamic>> login(
      String identifier,
      String password,
      String deviceIdentifier,
      ) async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/login'),
        body: json.encode({
          'identifier': identifier,
          'password': password,
          'deviceIdentifier': deviceIdentifier,
          'otpMethod': 'phone',
        }),
      );
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (kDebugMode) print('Login response: ${jsonEncode(result)}');
        if (result['accessToken'] != null) {
          _ensureRoles(result, result['accessToken']);
          await CookieManager.saveCookies({
            'accessToken': result['accessToken'],
            'refreshToken': result['refreshToken'] ?? '',
          });
          await CookieManager.extractCookies(response);
        }
        return result;
      }
      throw Exception(_parseError(response));
    } catch (e) {
      if (kDebugMode) print('Login error: $e');
      throw Exception(_parseError(e));
    }
  }

  static Future<Map<String, dynamic>> verify2FA(
      String userID,
      String otpCode,
      bool trustDevice,
      String tempToken,
      String refreshToken,
      String deviceIdentifier,
      ) async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/2fa/verify'),
        body: json.encode({
          'userID': userID,
          'otpCode': otpCode,
          'trustDevice': trustDevice,
          'tempToken': tempToken,
          'refreshToken': refreshToken,
          'deviceIdentifier': deviceIdentifier,
        }),
      );
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result['accessToken'] != null) {
          _ensureRoles(result, result['accessToken']);
          await CookieManager.saveCookies({
            'accessToken': result['accessToken'],
            'refreshToken': result['refreshToken'] ?? '',
          });
          await CookieManager.extractCookies(response);
        }
        return result;
      }
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e));
    }
  }

  static Future<Map<String, dynamic>> refreshToken(String refreshToken) async {
    try {
      await CookieManager.saveCookies({'refreshToken': refreshToken});
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/refresh'),
        headers: CookieManager.getHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
        body: 'refresh_token=$refreshToken',
      );
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        await CookieManager.saveCookies({
          'accessToken': result['accessToken'],
          'refreshToken': result['refreshToken'] ?? refreshToken,
        });
        await CookieManager.extractCookies(response);
        if (kDebugMode) print('Token refresh successful: ${result['accessToken']}');
        return result;
      } else {
        final error = jsonDecode(response.body)['error'] ?? 'Unknown error';
        throw Exception('Refresh failed: $error');
      }
    } catch (e) {
      if (kDebugMode) print('Refresh token error: $e');
      if (e.toString().contains('Invalid refresh token') || e.toString().contains('401')) {
        await CookieManager.clearCookies();
        throw Exception('Session expired. Please log in again.');
      }
      throw Exception('Refresh failed: $e');
    }
  }

  static Future<dynamic> makeAuthenticatedRequest({
    required Future<http.Response> Function() request,
  }) async {
    try {
      final response = await request();
      if (response.statusCode == 401) {
        final refreshToken = CookieManager.cookies['refreshToken'];
        if (refreshToken == null || refreshToken.isEmpty) {
          await CookieManager.clearCookies();
          throw Exception('Session expired. Please log in again.');
        }
        try {
          final refreshResult = await AuthService.refreshToken(refreshToken);
          if (kDebugMode) print('Refresh result: $refreshResult');
          final retryResponse = await request();
          return json.decode(retryResponse.body);
        } catch (e) {
          await CookieManager.clearCookies();
          throw Exception('Session expired. Please log in again.');
        }
      }
      return json.decode(response.body);
    } catch (e) {
      if (kDebugMode) print('Authenticated request failed: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> resend2FA(
      String userID,
      String otpMethod,
      ) async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/2fa/resend'),
        body: json.encode({'userID': userID, 'otpMethod': otpMethod}),
      );
      if (response.statusCode == 200) return json.decode(response.body);
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e));
    }
  }

  static Future<Map<String, dynamic>> initiatePasswordReset(
      String identifier,
      ) async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/password/reset/initiate'),
        body: json.encode({'identifier': identifier}),
      );
      if (response.statusCode == 200) return json.decode(response.body);
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e));
    }
  }

  static Future<Map<String, dynamic>> verifyPasswordResetOTP(
      String userID,
      String otpCode,
      ) async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/password/reset/verify'),
        body: json.encode({'userID': userID, 'otpCode': otpCode}),
      );
      if (response.statusCode == 200) return json.decode(response.body);
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e));
    }
  }

  static Future<void> resetPassword(
      String userID,
      String newPassword,
      String tempToken,
      ) async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/password/reset'),
        body: json.encode({
          'userID': userID,
          'newPassword': newPassword,
          'tempToken': tempToken,
        }),
      );
      if (response.statusCode != 200) throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e));
    }
  }

  static Future<void> logout() async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/logout'),
      );
      if (response.statusCode != 200) throw Exception(_parseError(response));
    } catch (e) {
      if (kDebugMode) print('Logout error: $e');
    } finally {
      await CookieManager.clearCookies();
    }
  }

  static void _ensureRoles(Map<String, dynamic> data, String accessToken) {
    if (data['roles'] == null || (data['roles'] as List).isEmpty) {
      final decodedToken = JwtDecoder.decode(accessToken);
      if (kDebugMode) {
        print('Decoded token for roles: ${jsonEncode(decodedToken)}');
      }
      final realmRoles =
          (decodedToken['realm_access']?['roles'] as List<dynamic>?) ?? [];
      data['roles'] = realmRoles
          .where((role) => role != null)
          .map((role) => role.toString())
          .toList();
      if (kDebugMode) {
        print('Assigned roles: ${data['roles']}');
      }
    }
  }

  static String _parseError(dynamic input) {
    if (input is http.Response) {
      try {
        final body = json.decode(input.body);
        return body['error'] ??
            body['message'] ??
            body['error_description'] ??
            _getErrorMessage(input.statusCode);
      } catch (_) {
        return _getErrorMessage(input.statusCode);
      }
    }
    if (input is PlatformException) {
      return input.message ?? 'Platform error occurred';
    }
    return input.toString().replaceFirst('Exception: ', '');
  }

  static String _getErrorMessage(int statusCode) {
    switch (statusCode) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Authentication failed. Please check your credentials.';
      case 403:
        return 'Account locked or access denied.';
      case 404:
        return 'Account not found.';
      case 429:
        return 'Too many attempts. Please wait.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return 'An unexpected error occurred.';
    }
  }
}