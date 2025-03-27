// lib/services/auth_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import '../utils/constants.dart';

class AuthService {
  static Future<Map<String, dynamic>> login(String identifier, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'identifier': identifier, 'password': password}),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body); // { token, user }
    } else {
      throw Exception('Login failed: ${response.body}');
    }
  }

  static Future<String> verify2FA(String userID, String otpCode) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/verify-2fa'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'userID': userID, 'otpCode': otpCode}),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body)['token']; // Authenticated token
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
}