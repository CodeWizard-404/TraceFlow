import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../utils/constants.dart';
import '../services/cookie_manager.dart';

class PermissionService {
  Future<List<dynamic>> getPermissionsByRole(String roleID) async {
    if (kDebugMode) print('PermissionService: Fetching permissions for role ID: $roleID');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/permissions/role/$roleID'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        if (kDebugMode) print('Permissions fetched: ${data.length}');
        return data; // Return Permission model list if defined
      } else {
        final error = 'Failed to fetch permissions: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching permissions: $e');
      throw Exception('Error fetching permissions: $e');
    }
  }

  Future<List<dynamic>> getEffectivePermissions(String userID) async {
    if (kDebugMode) print('PermissionService: Fetching effective permissions for user ID: $userID');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/permissions/effective/$userID'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        if (kDebugMode) print('Effective permissions fetched: ${data.length}');
        return data; // Return Permission model list if defined
      } else {
        final error = 'Failed to fetch effective permissions: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching effective permissions: $e');
      throw Exception('Error fetching effective permissions: $e');
    }
  }
}