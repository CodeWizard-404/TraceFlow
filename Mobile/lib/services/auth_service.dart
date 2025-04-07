import 'dart:convert';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';

class AuthService {
  static Future<Map<String, dynamic>> login(
      String identifier, String password, String deviceIdentifier, String otpMethod) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'identifier': identifier,
        'password': password,
        'deviceIdentifier': deviceIdentifier,
        'otpMethod': otpMethod,
      }),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception(response.body);
    }
  }

  static Future<Map<String, dynamic>> verify2FA(
      String userID, String otpCode, String deviceIdentifier, bool trustDevice) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/verify-2fa'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'userID': userID,
        'otpCode': otpCode,
        'deviceIdentifier': deviceIdentifier,
        'trustDevice': trustDevice,
      }),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception(response.body);
    }
  }

  static Future<Map<String, dynamic>> resend2FA(String userID, String method) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/resend-2fa'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'userID': userID}),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception(response.body);
    }
  }

  static Future<Map<String, dynamic>> initiatePasswordReset(String identifier) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/password-reset/initiate'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'identifier': identifier}),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception(response.body);
    }
  }

  static Future<Map<String, dynamic>> verifyPasswordResetOTP(String userID, String otpCode) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/password-reset/verify'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'userID': userID, 'otpCode': otpCode}),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception(response.body);
    }
  }

  static Future<void> resetPassword(String userID, String newPassword) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/password-reset/reset'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'userID': userID, 'newPassword': newPassword}),
    );
    if (response.statusCode == 200) {
      return;
    } else {
      throw Exception(response.body);
    }
  }
}