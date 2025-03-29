import 'dart:convert';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';

class RoleService {
  static Future<List<dynamic>> getRolesByUser(String userID, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/roles/user/$userID'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final List<dynamic> decodedData = json.decode(response.body);
      return decodedData; // Adjust to Role model if defined
    } else {
      throw Exception('Failed to fetch roles by user: ${response.body}');
    }
  }
}