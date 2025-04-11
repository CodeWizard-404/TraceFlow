import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import '../utils/constants.dart';

class UserService {
  static Future<User> fetchUserProfile(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/profile'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return User.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to fetch user profile: ${response.body}');
    }
  }

  static Future<User> updateProfile(String token, Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/users/profile');
    final request = http.MultipartRequest('PUT', uri)
      ..headers['Authorization'] = 'Bearer $token';

    data.forEach((key, value) {
      if (key == 'PFP' && value is http.MultipartFile) {
        request.files.add(value);
      } else if (value != null) {
        request.fields[key] = value.toString();
      }
    });

    final response = await request.send();
    final responseBody = await response.stream.bytesToString();

    if (response.statusCode == 200) {
      return User.fromJson(json.decode(responseBody));
    } else {
      throw Exception('Failed to update profile: $responseBody');
    }
  }

  static Future<User> fetchUserById(String userID, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/$userID'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return User.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to fetch user: ${response.body}');
    }
  }

  static Future<List<User>> getAllUsers(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final List<dynamic> decodedData = json.decode(response.body);
      return decodedData.map((json) => User.fromJson(json)).toList();
    } else {
      throw Exception('Failed to fetch all users: ${response.body}');
    }
  }

  static Future<List<User>> getUsersByRole(String role, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/role/$role'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final List<dynamic> decodedData = json.decode(response.body);
      return decodedData.map((json) => User.fromJson(json)).toList();
    } else {
      throw Exception('Failed to fetch users by role: ${response.body}');
    }
  }

  static Future<User> getUserByPhoneNumber(String phone, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/phone/$phone'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return User.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to fetch user by phone: ${response.body}');
    }
  }

  static Future<List<User>> getManagersByUser(String userID, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/$userID/managers'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final List<dynamic> decodedData = json.decode(response.body);
      return decodedData.map((json) => User.fromJson(json)).toList();
    } else {
      throw Exception('Failed to fetch managers: ${response.body}');
    }
  }



}