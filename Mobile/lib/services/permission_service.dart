import 'dart:convert';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';

class PermissionService {
  static Future<List<dynamic>> getPermissionsByRole(String roleID, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/permissions/role/$roleID'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final List<dynamic> decodedData = json.decode(response.body);
      return decodedData; // Adjust to Permission model if defined
    } else {
      throw Exception('Failed to fetch permissions by role: ${response.body}');
    }
  }

  static Future<List<dynamic>> getEffectivePermissions(String userID, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/permissions/effective/$userID'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final List<dynamic> decodedData = json.decode(response.body);
      return decodedData; // Adjust to Permission model if defined
    } else {
      throw Exception('Failed to fetch effective permissions: ${response.body}');
    }
  }
}