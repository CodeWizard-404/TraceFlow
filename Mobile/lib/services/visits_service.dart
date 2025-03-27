// lib/services/visit_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/visit.dart';
import '../utils/constants.dart';

class VisitService {
  // Log visit details (duration, checklists, comment, photos)
  static Future<Visit> logVisit({
    required String visitId,
    required int duration,
    required List<Map<String, dynamic>> checklistUpdates,
    String? comment,
    required String token,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/visits/$visitId/log'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'duration': duration,
        'checklistUpdates': checklistUpdates,
        'comment': comment,
      }),
    );
    if (response.statusCode == 200) {
      return Visit.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to log visit: ${response.body}');
    }
  }

  // Fetch visit by ID
  static Future<Visit> fetchVisitById(String visitId, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/visits/$visitId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return Visit.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to fetch visit: ${response.body}');
    }
  }

  // Update visit details
  static Future<Visit> updateVisit({
    required String visitId,
    String? date,
    String? time,
    int? duration,
    String? location,
    String? status,
    String? comment,
    String? agentID,
    List<Map<String, dynamic>>? checklists,
    List<Map<String, dynamic>>? reasons,
    String? supervisorID,
    required String token,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/visits/$visitId'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        if (date != null) 'date': date,
        if (time != null) 'time': time,
        if (duration != null) 'duration': duration,
        if (location != null) 'location': location,
        if (status != null) 'status': status,
        if (comment != null) 'comment': comment,
        if (agentID != null) 'agentID': agentID,
        if (checklists != null) 'checklists': checklists,
        if (reasons != null) 'reasons': reasons,
        if (supervisorID != null) 'supervisorID': supervisorID,
      }),
    );
    if (response.statusCode == 200) {
      return Visit.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to update visit: ${response.body}');
    }
  }

  // Delete a visit
  static Future<void> deleteVisit(String visitId, String token) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/visits/$visitId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to delete visit: ${response.body}');
    }
  }
}