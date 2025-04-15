import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';
import './cookie_manager.dart';

class AuthService {
  static Future<Map<String, dynamic>> checkAuthStatus() async {
    if (kDebugMode) print('AuthService.checkAuthStatus called, cookies: ${CookieManager.cookies}');
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/test'),
        headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
      );
      if (kDebugMode) print('CheckAuthStatus response: ${response.statusCode}, ${response.body}');
      CookieManager.extractCookies(response);
      if (response.statusCode == 200) {
        dynamic result = json.decode(response.body);
        if (result is String) {
          if (kDebugMode) print('Response is a string, attempting to decode again');
          result = json.decode(result);
        }
        if (result is Map<String, dynamic>) {
          if (kDebugMode) print('Decoded checkAuthStatus result: $result');
          return result;
        }
        throw Exception('Invalid checkAuthStatus response format: expected Map, got ${result.runtimeType}');
      } else {
        throw Exception(_parseError(response));
      }
    } catch (e) {
      if (kDebugMode) print('CheckAuthStatus error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> login(
      String identifier, String password, String otpMethod) async {
    if (kDebugMode) print('AuthService.login called with identifier: $identifier, otpMethod: $otpMethod');
    try {
      final url = Uri.parse('$baseUrl/auth/login');
      if (kDebugMode) print('Sending POST to $url');
      final response = await http.post(
        url,
        headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        body: json.encode({
          'identifier': identifier,
          'password': password,
          'otpMethod': otpMethod,
        }),
      );
      if (kDebugMode) print('Login response: ${response.statusCode}, ${response.body}');
      CookieManager.extractCookies(response);
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) {
          if (kDebugMode) print('Raw login result: $result');
          return result;
        }
        throw Exception('Invalid login response format');
      } else {
        throw Exception(_parseError(response));
      }
    } catch (e) {
      if (kDebugMode) print('AuthService.login error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<Map<String, dynamic>> verify2FA(
      String userID, String otpCode, bool trustDevice, String tempToken, String refreshToken) async {
    if (kDebugMode) print('AuthService.verify2FA called with userID: $userID');
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/verify-2fa'),
        headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        body: json.encode({
          'userID': userID,
          'otpCode': otpCode,
          'trustDevice': trustDevice,
          'tempToken': tempToken,
          'refreshToken': refreshToken,
        }),
      );
      if (kDebugMode) print('Verify2FA response: ${response.statusCode}, ${response.body}');
      CookieManager.extractCookies(response);
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) {
          return result;
        }
        throw Exception('Invalid verify2FA response format');
      } else {
        throw Exception(_parseError(response));
      }
    } catch (e) {
      if (kDebugMode) print('Verify2FA error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<Map<String, dynamic>> refreshToken() async {
    if (kDebugMode) print('AuthService.refreshToken called, cookies: ${CookieManager.cookies}');
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/refresh'),
        headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
      );
      if (kDebugMode) print('Refresh token response: ${response.statusCode}, ${response.body}');
      CookieManager.extractCookies(response);
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) {
          return result;
        }
        throw Exception('Invalid refresh token response format');
      } else {
        throw Exception(_parseError(response));
      }
    } catch (e) {
      if (kDebugMode) print('Refresh token error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<Map<String, dynamic>> resend2FA(String userID, String otpMethod) async {
    if (kDebugMode) print('AuthService.resend2FA called with userID: $userID, method: $otpMethod');
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/resend-2fa'),
        headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        body: json.encode({'userID': userID, 'otpMethod': otpMethod}),
      );
      if (kDebugMode) print('Resend2FA response: ${response.statusCode}, ${response.body}');
      CookieManager.extractCookies(response);
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) {
          return result;
        }
        throw Exception('Invalid resend2FA response format');
      } else {
        throw Exception(_parseError(response));
      }
    } catch (e) {
      if (kDebugMode) print('Resend2FA error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<Map<String, dynamic>> initiatePasswordReset(String identifier) async {
    if (kDebugMode) print('AuthService.initiatePasswordReset called with identifier: $identifier');
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/reset-password/init'),
        headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        body: json.encode({'identifier': identifier}),
      );
      if (kDebugMode) print('InitiatePasswordReset response: ${response.statusCode}, ${response.body}');
      CookieManager.extractCookies(response);
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) {
          return result;
        }
        throw Exception('Invalid initiatePasswordReset response format');
      } else {
        throw Exception(_parseError(response));
      }
    } catch (e) {
      if (kDebugMode) print('InitiatePasswordReset error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<Map<String, dynamic>> verifyPasswordResetOTP(String userID, String otpCode) async {
    if (kDebugMode) print('AuthService.verifyPasswordResetOTP called with userID: $userID');
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/reset-password/verify'),
        headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        body: json.encode({'userID': userID, 'otpCode': otpCode}),
      );
      if (kDebugMode) print('VerifyPasswordResetOTP response: ${response.statusCode}, ${response.body}');
      CookieManager.extractCookies(response);
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result is Map<String, dynamic>) {
          return result;
        }
        throw Exception('Invalid verifyPasswordResetOTP response format');
      } else {
        throw Exception(_parseError(response));
      }
    } catch (e) {
      if (kDebugMode) print('VerifyPasswordResetOTP error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<void> resetPassword(String userID, String newPassword, String tempToken) async {
    if (kDebugMode) print('AuthService.resetPassword called with userID: $userID');
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/reset-password'),
        headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        body: json.encode({'userID': userID, 'newPassword': newPassword, 'tempToken': tempToken}),
      );
      if (kDebugMode) print('ResetPassword response: ${response.statusCode}, ${response.body}');
      CookieManager.extractCookies(response);
      if (response.statusCode == 200) {
        return;
      } else {
        throw Exception(_parseError(response));
      }
    } catch (e) {
      if (kDebugMode) print('ResetPassword error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<void> logout() async {
    if (kDebugMode) print('AuthService.logout called');
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/logout'),
        headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
      );
      if (kDebugMode) print('Logout response: ${response.statusCode}, ${response.body}');
      await CookieManager.clearCookies(caller: 'AuthService.logout');
      if (response.statusCode != 200) {
        throw Exception(_parseError(response));
      }
    } catch (e) {
      if (kDebugMode) print('Logout error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<dynamic> makeAuthenticatedRequest({
    required Future<http.Response> Function() request,

  }) async {
    if (kDebugMode) print('Making authenticated request, cookies: ${CookieManager.cookies}');
    try {
      final response = await request();
      if (kDebugMode) print('Authenticated request response: ${response.statusCode}, ${response.body}');
      CookieManager.extractCookies(response);
      if (response.statusCode == 401) {
        if (kDebugMode) print('Received 401, attempting to refresh token, cookies: ${CookieManager.cookies}');
        try {
          final refreshResult = await refreshToken();
          if (kDebugMode) print('Refresh result: $refreshResult, new cookies: ${CookieManager.cookies}');
// Retry the original request with new cookies
          final retryResponse = await request();
          if (kDebugMode) print('Retry response: ${retryResponse.statusCode}, ${retryResponse.body}');
          CookieManager.extractCookies(retryResponse);
          return json.decode(retryResponse.body);
        } catch (e) {
          if (kDebugMode) print('Refresh failed: $e');
          if (e.toString().contains('Invalid refresh token')) {
            await CookieManager.clearCookies(caller: 'makeAuthenticatedRequest.refresh');
          }
          throw Exception('Authentication failed: Unable to refresh token');
        }
      }
      return json.decode(response.body);
    } catch (e) {
      if (kDebugMode) print('Authenticated request failed: $e');
      rethrow;
    }
  }

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
            return 'Something went wrong on our end. Please try again later.';
          default:
            return 'An error occurred. Please try again.';
        }
      }
      final errorStr = input.toString();
      if (errorStr.contains('Network Error')) {
        return 'Unable to connect to the server. Check your connection.';
      }
      return errorStr.isNotEmpty ? errorStr : 'An error occurred. Please try again.';
    } catch (e) {
      if (kDebugMode) print('Error parsing error: $e');
      return 'An error occurred. Please try again.';
    }
  }
}