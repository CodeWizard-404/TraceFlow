import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/checklist.dart';
import '../utils/constants.dart';

class ChecklistService {
  static Future<List<Checklist>> getChecklistsByVisitId(String visitId) async {
    final response = await http.get(Uri.parse('$baseUrl/visits/$visitId/checklists'));
    if (response.statusCode == 200) {
      List<dynamic> data = json.decode(response.body);
      return data.map((json) => Checklist.fromJson(json)).toList();
    } else {
      throw Exception('Failed to fetch checklists');
    }
  }

  static Future<Checklist> createChecklistItem(String text) async {
    final response = await http.post(
      Uri.parse('$baseUrl/checklists'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'text': text}),
    );
    return Checklist.fromJson(json.decode(response.body));
  }
}