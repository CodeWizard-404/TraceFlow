import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/checklist.dart';
import '../utils/constants.dart';

class ChecklistService {
  static Future<List<Checklist>> getChecklistsByVisitId(String visitId, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/checklists/$visitId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      List<dynamic> data = json.decode(response.body);
      return data.map((json) => Checklist.fromJson(json)).toList();
    } else {
      throw Exception('Failed to fetch checklists: ${response.body}');
    }
  }

  static Future<List<Checklist>> getAllChecklists(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/checklists'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      List<dynamic> data = json.decode(response.body);
      return data.map((json) => Checklist.fromJson(json)).toList();
    } else {
      throw Exception('Failed to fetch all checklists: ${response.body}');
    }
  }
}