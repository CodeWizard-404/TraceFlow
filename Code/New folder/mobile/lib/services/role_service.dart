import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/role.dart';
import '../utils/constants.dart';
import './cookie_manager.dart';
import './auth_service.dart';

class RoleService {
  Future<List<Role>> getRolesByUser(String userID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/roles/user/$userID');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch roles: ${response.statusCode}');
        },
      );
      return (response as List).map((json) => Role.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching roles: $e');
      rethrow;
    }
  }
}