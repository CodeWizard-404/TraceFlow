import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';
import '../utils/constants.dart';

class AuthService {
  static Future<Map<String, dynamic>> login(
      String identifier, String password, String deviceIdentifier, String otpMethod) async {
    if (kDebugMode) print('AuthService.login called with identifier: $identifier, device: $deviceIdentifier, otpMethod: $otpMethod');
    try {
      final url = Uri.parse('$baseUrl/auth/login');
      if (kDebugMode) print('Sending POST to $url');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'identifier': identifier,
          'password': password,
          'deviceIdentifier': deviceIdentifier,
          'otpMethod': otpMethod,
        }),
      );
      if (kDebugMode) print('Response status: ${response.statusCode}, body: ${response.body}');
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (kDebugMode) print('Raw login result: $result');
        // Check if 'requires2FA' exists in the response
        if (result.containsKey('requires2FA')) {
          if (result['requires2FA'] == true) {
            if (kDebugMode) print('2FA required for this login');
            return result; // Return early for 2FA flow
          } else {
            if (kDebugMode) print('No 2FA required, proceeding with login');
            await _storeTokens(result['token'], result['refreshToken'], result['expiresIn']);
          }
        } else {
          // Trusted device case: no requires2FA key, assume successful login
          if (kDebugMode) print('Trusted device login detected');
          await _storeTokens(result['token'], result['refreshToken'], result['expiresIn']);
        }
        return result;
      } else {
        throw Exception(_parseError(response.body));
      }
    } catch (e) {
      if (kDebugMode) print('AuthService.login error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<Map<String, dynamic>> verify2FA(
      String userID, String otpCode, String deviceIdentifier, bool trustDevice, String tempToken, String refreshToken) async {
    if (kDebugMode) print('AuthService.verify2FA called with userID: $userID');
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/verify-2fa'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'userID': userID,
          'otpCode': otpCode,
          'deviceIdentifier': deviceIdentifier,
          'trustDevice': trustDevice,
          'tempToken': tempToken,
          'refreshToken': refreshToken,
        }),
      );
      if (kDebugMode) print('Verify2FA response: ${response.statusCode}, body: ${response.body}');
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        await _storeTokens(result['token'], result['refreshToken'], result['expiresIn']);
        return result;
      } else {
        throw Exception(_parseError(response.body));
      }
    } catch (e) {
      if (kDebugMode) print('Verify2FA error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<Map<String, dynamic>> refreshToken(String refreshToken) async {
    if (kDebugMode) print('AuthService.refreshToken called');
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'refreshToken': refreshToken}),
      );
      if (kDebugMode) print('Refresh token response: ${response.statusCode}, body: ${response.body}');
      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        await _storeTokens(result['accessToken'], result['refreshToken'], result['expiresIn']);
        return result;
      } else {
        throw Exception(_parseError(response.body));
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
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'userID': userID, 'otpMethod': otpMethod}),
      );
      if (kDebugMode) print('Resend2FA response: ${response.statusCode}, body: ${response.body}');
      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception(_parseError(response.body));
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
        Uri.parse('$baseUrl/auth/password-reset/initiate'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'identifier': identifier}),
      );
      if (kDebugMode) print('InitiatePasswordReset response: ${response.statusCode}, body: ${response.body}');
      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception(_parseError(response.body));
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
        Uri.parse('$baseUrl/auth/password-reset/verify'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'userID': userID, 'otpCode': otpCode}),
      );
      if (kDebugMode) print('VerifyPasswordResetOTP response: ${response.statusCode}, body: ${response.body}');
      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception(_parseError(response.body));
      }
    } catch (e) {
      if (kDebugMode) print('VerifyPasswordResetOTP error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<void> resetPassword(String userID, String newPassword) async {
    if (kDebugMode) print('AuthService.resetPassword called with userID: $userID');
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/password-reset/reset'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'userID': userID, 'newPassword': newPassword}),
      );
      if (kDebugMode) print('ResetPassword response: ${response.statusCode}, body: ${response.body}');
      if (response.statusCode == 200) {
        return;
      } else {
        throw Exception(_parseError(response.body));
      }
    } catch (e) {
      if (kDebugMode) print('ResetPassword error: $e');
      throw Exception(_parseError(e.toString()));
    }
  }

  static Future<Map<String, dynamic>> makeAuthenticatedRequest({
    required Future<http.Response> Function() request,
    required String accessToken,
  }) async {
    if (kDebugMode) print('Making authenticated request with token: $accessToken');
    try {
      final response = await request();
      if (kDebugMode) print('Authenticated request response: ${response.statusCode}, body: ${response.body}');
      if (response.statusCode == 401 && json.decode(response.body)['error'] == 'Token expired, please refresh') {
        final prefs = await SharedPreferences.getInstance();
        final refreshToken = prefs.getString('refreshToken');
        if (refreshToken == null) {
          if (kDebugMode) print('No refresh token available');
          throw Exception('No refresh token available');
        }
        final newTokens = await AuthService.refreshToken(refreshToken);
        if (kDebugMode) print('Retrying with new token: ${newTokens['accessToken']}');
        return makeAuthenticatedRequest(
          request: () async {
            final headers = {'Content-Type': 'application/json', 'Authorization': 'Bearer ${newTokens['accessToken']}'};
            return request().then((resp) => http.Response(resp.body, resp.statusCode, headers: headers));
          },
          accessToken: newTokens['accessToken'],
        );
      }
      return json.decode(response.body);
    } catch (e) {
      if (kDebugMode) print('Authenticated request failed: $e');
      rethrow;
    }
  }

  static Future<void> _storeTokens(String accessToken, String refreshToken, int expiresIn) async {
    if (kDebugMode) print('Storing tokens: accessToken=$accessToken, expiresIn=$expiresIn');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', accessToken);
    await prefs.setString('refreshToken', refreshToken);
    await prefs.setInt('expiresIn', expiresIn);
  }

  static String _parseError(String body) {
    if (kDebugMode) print('Parsing error body: $body');
    try {
      final jsonBody = json.decode(body);
      return jsonBody['error'] ?? 'An error occurred';
    } catch (_) {
      return body.isNotEmpty ? body : 'An error occurred';
    }
  }
}