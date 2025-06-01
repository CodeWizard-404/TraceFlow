import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import '../utils/constants.dart';
import './cookie_manager.dart';
import './http_client.dart';

class AuthService {
  static Future<Map<String, dynamic>> initiateKeycloakLogin() async {
    try {
      final authUrl =
          '$keycloakUrl/realms/$realm/protocol/openid-connect/auth?client_id=$clientId&redirect_uri=${Uri.encodeComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&kc_idp_hint=google&prompt=select_account';
      final result = await FlutterWebAuth2.authenticate(
        url: authUrl,
        callbackUrlScheme: 'http',
      );
      final code = Uri.parse(result).queryParameters['code'];
      if (code == null) throw Exception('No authorization code received');

      final tokenResponse = await http.post(
        Uri.parse('$keycloakUrl/realms/$realm/protocol/openid-connect/token'),
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: {
          'grant_type': 'authorization_code',
          'code': code,
          'redirect_uri': redirectUri,
          'client_id': clientId,
          'client_secret': clientSecret,
        },
      );
      if (tokenResponse.statusCode != 200) {
        throw Exception(
          'Failed to exchange code: ${json.decode(tokenResponse.body)['error_description'] ?? tokenResponse.body}',
        );
      }

      final tokens = json.decode(tokenResponse.body);
      final accessToken = tokens['access_token'] as String;
      final refreshToken = tokens['refresh_token'] as String;
      await CookieManager.saveCookies({
        'accessToken': accessToken,
        'refreshToken': refreshToken,
      });

      final userResponse = await CustomHttpClient.get(
        Uri.parse('$baseUrl/test'),
      );
      if (userResponse.statusCode != 200) {
        throw Exception('Failed to fetch user data: ${userResponse.body}');
      }

      final userData = json.decode(userResponse.body);
      _ensureRoles(userData, accessToken);

      final requires2FA = await _check2FARequired();
      if (requires2FA) {
        return {
          'userID': userData['user']?['userID']?.toString(),
          'requires2FA': true,
          'tempToken': accessToken,
          'refreshToken': refreshToken,
          'expiresIn': tokens['expires_in'] * 1000,
          'otpMethod': 'phone',
        };
      }

      return {
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'expiresIn': tokens['expires_in'] * 1000,
        'user': userData['user'],
      };
    } catch (e) {
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
        final accessToken = CookieManager.cookies['accessToken'];
        if (accessToken != null) _ensureRoles(result, accessToken);
        return result;
      }
      throw Exception(_parseError(response));
    } catch (e) {
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
      // Ensure refreshToken is stored in cookies before the request
      await CookieManager.saveCookies({'refreshToken': refreshToken});
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/refresh'),
        // No body or custom Content-Type needed; backend reads from cookies
      );
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        await CookieManager.saveCookies({
          'accessToken': result['accessToken'],
          'refreshToken': result['refreshToken'] ?? refreshToken,
        });
        return result;
      }
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e));
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
    if (data['user'] == null ||
        data['user']['roles'] == null ||
        (data['user']['roles'] as List).isEmpty) {
      final decodedToken = JwtDecoder.decode(accessToken);
      final realmRoles =
          (decodedToken['realm_access']?['roles'] as List<dynamic>?) ?? [];
      data['user'] ??= {'roles': []};
      data['user']['roles'] = realmRoles
          .where((role) => role != null)
          .toList()
          .asMap()
          .entries
          .map(
            (e) => {
          'roleID': (e.key + 1).toString(),
          'name': e.value.toString(),
          'description': null,
          'permissions': [],
        },
      )
          .toList();
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

  static Future<dynamic> makeAuthenticatedRequest({
    required Future<http.Response> Function() request,
  }) async {
    try {
      final response = await request();
      if (response.statusCode == 401) {
        final refreshToken = CookieManager.cookies['refreshToken'];
        if (refreshToken == null || refreshToken.isEmpty) {
          throw Exception('No refresh token available');
        }
        try {
          final refreshResult = await refreshToken;
          if (kDebugMode) print('Refresh result: $refreshResult');
          final retryResponse = await request();
          return json.decode(retryResponse.body);
        } catch (e) {
          if (e.toString().contains('Invalid refresh token')) {
            await CookieManager.clearCookies();
          }
          throw Exception('Authentication failed');
        }
      }
      return json.decode(response.body);
    } catch (e) {
      if (kDebugMode) print('Authenticated request failed: $e');
      rethrow;
    }
  }
}