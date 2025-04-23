import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';
import '../utils/device_utils.dart';
import './cookie_manager.dart';
import './http_client.dart';

// Handles authentication-related API calls for the TraceFlow mobile app.
class AuthService {
  // Checks current authentication status.
  static Future<Map<String, dynamic>> checkAuthStatus() async {
    try {
      final response = await CustomHttpClient.get(
        Uri.parse('$baseUrl/test'),
        headers: {'Content-Type': 'application/json'},
      );
      if (kDebugMode) print('CheckAuthStatus: ${response.statusCode}');
      if (response.statusCode == 200) {
        dynamic result = json.decode(response.body);
        if (result is String) result = json.decode(result);
        if (result is Map<String, dynamic>) return result;
        throw Exception('Invalid checkAuthStatus response');
      }
      throw Exception(_parseError(response));
    } catch (e) {
      if (kDebugMode) print('CheckAuthStatus error: $e');
      rethrow;
    }
  }

  // Initiates login with identifier and password.
  static Future<Map<String, dynamic>> login(String identifier, String password, String otpMethod) async {
    try {
      final deviceIdentifier = await DeviceUtils.getDeviceIdentifier();
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'identifier': identifier,
          'password': password,
          'otpMethod': otpMethod,
          'deviceIdentifier': deviceIdentifier,
        }),
      );
      if (kDebugMode) print('Login: ${response.statusCode}');
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) return result;
        throw Exception('Invalid login response');
      }
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e.toString()));
    }
  }

  // Verifies 2FA OTP code.
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
        Uri.parse('$baseUrl/auth/verify-2fa'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'userID': userID,
          'otpCode': otpCode,
          'trustDevice': trustDevice,
          'tempToken': tempToken,
          'refreshToken': refreshToken,
          'deviceIdentifier': deviceIdentifier,
        }),
      );
      if (kDebugMode) print('Verify2FA: ${response.statusCode}');
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) return result;
        throw Exception('Invalid verify2FA response');
      }
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e.toString()));
    }
  }

  // Refreshes access token.
  static Future<Map<String, dynamic>> refreshToken() async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
      );
      if (kDebugMode) print('RefreshToken: ${response.statusCode}');
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) return result;
        throw Exception('Invalid refresh token response');
      }
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e.toString()));
    }
  }

  // Resends 2FA OTP.
  static Future<Map<String, dynamic>> resend2FA(String userID, String otpMethod) async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/resend-2fa'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'userID': userID, 'otpMethod': otpMethod}),
      );
      if (kDebugMode) print('Resend2FA: ${response.statusCode}');
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) return result;
        throw Exception('Invalid resend2FA response');
      }
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e.toString()));
    }
  }

  // Initiates password reset.
  static Future<Map<String, dynamic>> initiatePasswordReset(String identifier) async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/reset-password/init'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'identifier': identifier}),
      );
      if (kDebugMode) print('InitiatePasswordReset: ${response.statusCode}');
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) return result;
        throw Exception('Invalid initiatePasswordReset response');
      }
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e.toString()));
    }
  }

  // Verifies password reset OTP.
  static Future<Map<String, dynamic>> verifyPasswordResetOTP(String userID, String otpCode) async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/reset-password/verify'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'userID': userID, 'otpCode': otpCode}),
      );
      if (kDebugMode) print('VerifyPasswordResetOTP: ${response.statusCode}');
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) return result;
        throw Exception('Invalid verifyPasswordResetOTP response');
      }
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e.toString()));
    }
  }

  // Resets password.
  static Future<void> resetPassword(String userID, String newPassword, String tempToken) async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/reset-password'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'userID': userID, 'newPassword': newPassword, 'tempToken': tempToken}),
      );
      if (kDebugMode) print('ResetPassword: ${response.statusCode}');
      if (response.statusCode == 200) return;
      throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e.toString()));
    }
  }

  // Logs out the user.
  static Future<void> logout() async {
    try {
      final response = await CustomHttpClient.post(
        Uri.parse('$baseUrl/auth/logout'),
        headers: {'Content-Type': 'application/json'},
      );
      if (kDebugMode) print('Logout: ${response.statusCode}');
      await CookieManager.clearCookies(caller: 'AuthService.logout');
      if (response.statusCode != 200) throw Exception(_parseError(response));
    } catch (e) {
      throw Exception(_parseError(e.toString()));
    }
  }

  // Makes an authenticated request with automatic token refresh.
  static Future<dynamic> makeAuthenticatedRequest({
    required Future<http.Response> Function() request,
  }) async {
    try {
      final response = await request();
      if (response.statusCode == 401) {
        try {
          final refreshResult = await refreshToken();
          if (kDebugMode) print('Refresh result: $refreshResult');
          final retryResponse = await request();
          return json.decode(retryResponse.body);
        } catch (e) {
          if (e.toString().contains('Invalid refresh token')) {
            await CookieManager.clearCookies(caller: 'makeAuthenticatedRequest');
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

  // Parses error messages from responses or exceptions.
  static String _parseError(dynamic input) {
    try {
      if (input is http.Response) {
        final body = input.body;
        if (body.isNotEmpty) {
          final jsonBody = json.decode(body);
          if (jsonBody is Map && jsonBody.containsKey('error')) {
            if (input.statusCode == 429 && jsonBody.containsKey('waitTime')) {
              return '${jsonBody['error']} Wait ${jsonBody['waitTime']} seconds.';
            }
            return jsonBody['error'] as String;
          }
        }
        switch (input.statusCode) {
          case 401:
            return 'Please log in to continue.';
          case 403:
            return 'You don’t have permission to perform this action.';
          case 429:
            return 'Too many attempts. Please wait.';
          case 500:
            return 'Something went wrong. Please try again later.';
          default:
            return 'An error occurred. Please try again.';
        }
      }
      final errorStr = input.toString();
      if (errorStr.contains('Network Error')) {
        return 'Unable to connect to the server. Check your connection.';
      }
      return errorStr.isNotEmpty ? errorStr.replaceFirst('Exception: ', '') : 'An error occurred.';
    } catch (e) {
      return 'An error occurred. Please try again.';
    }
  }
}