import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import '../utils/constants.dart';
import './auth_service.dart';
import './cookie_manager.dart';

class UserService {
  static Future<User> fetchUserProfile() async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/profile');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch profile: ${response.statusCode}');
        },
      );
      return User.fromJson(jsonDecode(response.body));
    } catch (e) {
      if (kDebugMode) print('Error fetching profile: $e');
      rethrow;
    }
  }

  static Future<User> updateProfile(Map<String, dynamic> data, {http.MultipartFile? pfpFile}) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final uri = Uri.parse('$baseUrl/users/profile');
          final request = http.MultipartRequest('PUT', uri)
            ..headers.addAll(CookieManager.getHeaders({'Content-Type': 'multipart/form-data'}));
          data.forEach((key, value) {
            if (value != null) {
              request.fields[key] = value.toString();
            }
          });
          if (pfpFile != null) {
            request.files.add(pfpFile);
          }
          final streamedResponse = await request.send();
          final responseBody = await streamedResponse.stream.bytesToString();
          if (streamedResponse.statusCode == 200) return jsonDecode(responseBody);
          throw Exception('Failed to update profile: $responseBody');
        },
      );
      return User.fromJson(response);
    } catch (e) {
      if (kDebugMode) print('Error updating profile: $e');
      rethrow;
    }
  }

  static Future<List<User>> getAllUsers() async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch users: ${response.statusCode}');
        },
      );
      return (jsonDecode(response.body) as List).map((json) => User.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching all users: $e');
      rethrow;
    }
  }

  static Future<User> getUserByPhoneNumber(String phone) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/phone/$phone');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch user by phone: ${response.statusCode}');
        },
      );
      return User.fromJson(jsonDecode(response.body));
    } catch (e) {
      if (kDebugMode) print('Error fetching user by phone: $e');
      rethrow;
    }
  }

  static Future<User> getUserById(String userID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/$userID');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch user by ID: ${response.statusCode}');
        },
      );
      return User.fromJson(jsonDecode(response.body));
    } catch (e) {
      if (kDebugMode) print('Error fetching user by ID: $e');
      rethrow;
    }
  }

  static Future<List<User>> getUsersByRole(String role) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/role/$role');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch users by role: ${response.statusCode}');
        },
      );
      return (jsonDecode(response.body) as List).map((json) => User.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching users by role: $e');
      rethrow;
    }
  }

  static Future<List<User>> getUsersByRegion(String regionID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/region/$regionID/users');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch users by region: ${response.statusCode}');
        },
      );
      return (jsonDecode(response.body) as List).map((json) => User.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching users by region: $e');
      rethrow;
    }
  }

  static Future<List<User>> getUsersByGovernorate(String governorateID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/governorate/$governorateID/users');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch users by governorate: ${response.statusCode}');
        },
      );
      return (jsonDecode(response.body) as List).map((json) => User.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching users by governorate: $e');
      rethrow;
    }
  }

  static Future<List<User>> getUsersByDelegation(String delegationID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/delegation/$delegationID/users');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch users by delegation: ${response.statusCode}');
        },
      );
      return (jsonDecode(response.body) as List).map((json) => User.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching users by delegation: $e');
      rethrow;
    }
  }

  static Future<List<User>> getSupervisorsByRegionalManager(String regionalManagerID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/regional-manager/$regionalManagerID/supervisors');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch supervisors by regional manager: ${response.statusCode}');
        },
      );
      return (jsonDecode(response.body) as List).map((json) => User.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching supervisors by regional manager: $e');
      rethrow;
    }
  }

  static Future<List<User>> getRegionalManagersByDirector(String directorID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/director/$directorID/regional-managers');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch regional managers by director: ${response.statusCode}');
        },
      );
      return (jsonDecode(response.body) as List).map((json) => User.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching regional managers by director: $e');
      rethrow;
    }
  }

  static Future<User> getDirectorByRegionalManager(String regionalManagerID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/regional-manager/$regionalManagerID/director');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch director by regional manager: ${response.statusCode}');
        },
      );
      return User.fromJson(jsonDecode(response.body));
    } catch (e) {
      if (kDebugMode) print('Error fetching director by regional manager: $e');
      rethrow;
    }
  }

  static Future<User> getRegionalManagerBySupervisor(String supervisorID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/supervisor/$supervisorID/regional-manager');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch regional manager by supervisor: ${response.statusCode}');
        },
      );
      return User.fromJson(jsonDecode(response.body));
    } catch (e) {
      if (kDebugMode) print('Error fetching regional manager by supervisor: $e');
      rethrow;
    }
  }

  static Future<List<User>> getSupervisorsByUser(String userID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/$userID/supervisors');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch supervisors by user: ${response.statusCode}');
        },
      );
      return (jsonDecode(response.body) as List).map((json) => User.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching supervisors by user: $e');
      rethrow;
    }
  }

  static Future<List<User>> getRegionalManagersByUser(String userID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/$userID/regional-managers');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch regional managers by user: ${response.statusCode}');
        },
      );
      return (jsonDecode(response.body) as List).map((json) => User.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching regional managers by user: $e');
      rethrow;
    }
  }

  static Future<User> getDirectorByUser(String userID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/users/$userID/director');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch director by user: ${response.statusCode}');
        },
      );
      return User.fromJson(jsonDecode(response.body));
    } catch (e) {
      if (kDebugMode) print('Error fetching director by user: $e');
      rethrow;
    }
  }
}