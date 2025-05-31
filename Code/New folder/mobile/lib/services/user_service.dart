import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import '../utils/constants.dart';
import './auth_service.dart';
import './cookie_manager.dart';

class UserService {
  static Future<User> fetchUserProfile() async {
    if (kDebugMode) print('Fetching user profile');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/users/profile');
        if (kDebugMode) print('GET $url');
        final response = await http.get(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to fetch user profile: ${response.body}');
      },
    ).then((data) {
      if (data is Map<String, dynamic>) {
        return User.fromJson(data);
      }
      throw Exception('Invalid user profile response format');
    });
  }

  static Future<User> updateProfile(Map<String, dynamic> data) async {
    if (kDebugMode) print('Updating profile with data: $data');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final uri = Uri.parse('$baseUrl/users/profile');
        if (kDebugMode) print('PUT $uri');
        final request = http.MultipartRequest('PUT', uri);
        request.headers.addAll(CookieManager.getHeaders({'Content-Type': 'multipart/form-data'}));

        data.forEach((key, value) {
          if (key == 'PFP' && value is http.MultipartFile) {
            request.files.add(value);
          } else if (value != null) {
            request.fields[key] = value.toString();
          }
        });

        final response = await request.send();
        final responseBody = await response.stream.bytesToString();
        final httpResponse = http.Response(responseBody, response.statusCode, headers: response.headers);

        if (kDebugMode) print('Response: ${response.statusCode}, $responseBody');
        CookieManager.extractCookies(httpResponse);
        if (response.statusCode == 200) {
          return httpResponse;
        }
        throw Exception('Failed to update profile: $responseBody');
      },
    ).then((data) {
      if (data is Map<String, dynamic>) {
        return User.fromJson(data);
      }
      throw Exception('Invalid update profile response format');
    });
  }

  static Future<User> fetchUserById(String userID) async {
    if (kDebugMode) print('Fetching user by ID: $userID');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/users/$userID');
        if (kDebugMode) print('GET $url');
        final response = await http.get(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to fetch user: ${response.body}');
      },
    ).then((data) {
      if (data is Map<String, dynamic>) {
        return User.fromJson(data);
      }
      throw Exception('Invalid user response format');
    });
  }

  static Future<List<User>> getAllUsers() async {
    if (kDebugMode) print('Fetching all users');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/users');
        if (kDebugMode) print('GET $url');
        final response = await http.get(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to fetch all users: ${response.body}');
      },
    ).then((data) {
      if (data is List<dynamic>) {
        return data.map((json) => User.fromJson(json as Map<String, dynamic>)).toList();
      }
      throw Exception('Invalid users response format');
    });
  }

  static Future<List<User>> getUsersByRole(String role) async {
    if (kDebugMode) print('Fetching users by role: $role');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/users/role/$role');
        if (kDebugMode) print('GET $url');
        final response = await http.get(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to fetch users by role: ${response.body}');
      },
    ).then((data) {
      if (data is List<dynamic>) {
        return data.map((json) => User.fromJson(json as Map<String, dynamic>)).toList();
      }
      throw Exception('Invalid users by role response format');
    });
  }

  static Future<User> getUserByPhoneNumber(String phone) async {
    if (kDebugMode) print('Fetching user by phone: $phone');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/users/phone/$phone');
        if (kDebugMode) print('GET $url');
        final response = await http.get(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to fetch user by phone: ${response.body}');
      },
    ).then((data) {
      if (data is Map<String, dynamic>) {
        return User.fromJson(data);
      }
      throw Exception('Invalid user by phone response format');
    });
  }

  static Future<List<User>> getManagersByUser(String userID) async {
    if (kDebugMode) print('Fetching managers for user: $userID');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/users/$userID/managers');
        if (kDebugMode) print('GET $url');
        final response = await http.get(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to fetch managers: ${response.body}');
      },
    ).then((data) {
      if (data is List<dynamic>) {
        return data.map((json) => User.fromJson(json as Map<String, dynamic>)).toList();
      }
      throw Exception('Invalid managers response format');
    });
  }
}