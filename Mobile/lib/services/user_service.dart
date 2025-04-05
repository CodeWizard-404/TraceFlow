import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import '../utils/constants.dart';

class UserService {
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
      print('Raw response for role $role: ${response.body}'); // Debug
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