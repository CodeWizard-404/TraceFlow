import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:device_info_plus/device_info_plus.dart';
import 'dart:io';
import '../utils/constants.dart';

class AuthService {
  static Future<String> _getDeviceIdentifier() async {
    final deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      return androidInfo.id; // Unique device ID for Android
    } else if (Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      return iosInfo.identifierForVendor ?? 'unknown_ios_device';
    }
    return 'unknown_device';
  }

  static Future<Map<String, dynamic>> login(
      String identifier, String password) async {
    final deviceIdentifier = await _getDeviceIdentifier();
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'identifier': identifier,
        'password': password,
        'deviceIdentifier': deviceIdentifier,
      }),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Login failed: ${response.body}');
    }
  }

  static Future<Map<String, dynamic>> verify2FA(
      String userID, String otpCode, bool trustDevice) async {
    final deviceIdentifier = await _getDeviceIdentifier();
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
      throw Exception('2FA verification failed: ${response.body}');
    }
  }

  static Future<void> resend2FA(String userID) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/resend-2fa'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'userID': userID}),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to resend 2FA: ${response.body}');
    }
  }

  static Future<Map<String, dynamic>> initiatePasswordReset(
      String identifier) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/password-reset/initiate'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'identifier': identifier}),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to initiate password reset: ${response.body}');
    }
  }

  static Future<Map<String, dynamic>> verifyPasswordResetOTP(
      String userID, String otpCode) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/password-reset/verify'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'userID': userID, 'otpCode': otpCode}),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to verify reset OTP: ${response.body}');
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
      throw Exception('Failed to reset password: ${response.body}');
    }
  }
}