import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../utils/constants.dart';
import '../services/cookie_manager.dart';

class RoleService {
  Future<List<dynamic>> getRolesByUser(String userID) async {
    if (kDebugMode) print('RoleService: Fetching roles for user ID: $userID');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/roles/user/$userID'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        if (kDebugMode) print('Roles fetched: ${data.length}');
        return data; // Return Role model list if defined
      } else {
        final error = 'Failed to fetch roles: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching roles: $e');
      throw Exception('Error fetching roles: $e');
    }
  }
}