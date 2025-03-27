// lib/services/checklist_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/checklist.dart';
import '../utils/constants.dart';

class ChecklistService {
  // Create a new checklist item
  static Future<Checklist> createChecklistItem(String text, String token) async {
    final response = await http.post(
      Uri.parse('$baseUrl/checklists'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({'text': text}),
    );
    if (response.statusCode == 201) {
      return Checklist.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to create checklist: ${response.body}');
    }
  }

  // Fetch checklists by visit ID
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

  // Fetch all checklists (for reference if needed)
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