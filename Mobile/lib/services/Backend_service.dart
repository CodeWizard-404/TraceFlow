// lib/services/backend_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class BackendService {
  static const String baseUrl = 'http://localhost:5000';

  // Create a new visit
  static Future<void> createVisit({
    required String date,
    required String time,
    required String location,
    required String agentID,
    required String supervisorID,
    required String timesheetID,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/visits'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'date': date,
        'time': time,
        'location': location,
        'agentID': agentID,
        'supervisorID': supervisorID,
        'timesheetID': timesheetID,
      }),
    );
    if (response.statusCode != 201) {
      throw Exception('Failed to create visit');
    }
  }

  // Log visit details
  static Future<void> logVisit({
    required String visitID,
    required String reason,
    required List<String> checklist,
    required List<String> photos,
    required String comment,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/visits/$visitID/log'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'reason': reason,
        'checklist': checklist,
        'photos': photos,
        'comment': comment,
      }),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to log visit');
    }
  }

  // Create a new timesheet
  static Future<void> createTimesheet({
    required int weekNumber,
    required int year,
    required String supervisorID,
    required List<Map<String, dynamic>> visits,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/timesheets'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'weekNumber': weekNumber,
        'year': year,
        'supervisorID': supervisorID,
        'visits': visits,
      }),
    );
    if (response.statusCode != 201) {
      throw Exception('Failed to create timesheet');
    }
  }

  // Fetch all timesheets
  static Future<List<dynamic>> getAllTimesheets() async {
    final response = await http.get(Uri.parse('$baseUrl/timesheets'));
    if (response.statusCode != 200) {
      throw Exception('Failed to fetch timesheets');
    }
    return jsonDecode(response.body);
  }

  // Fetch a specific timesheet by ID
  static Future<Map<String, dynamic>> getTimesheetById(String id) async {
    final response = await http.get(Uri.parse('$baseUrl/timesheets/$id'));
    if (response.statusCode != 200) {
      throw Exception('Failed to fetch timesheet');
    }
    return jsonDecode(response.body);
  }

  // Validate a timesheet
  static Future<void> validateTimesheet({
    required String id,
    required List<String> visitIDs,
    required String status,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/timesheets/$id/validate'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'visitIDs': visitIDs,
        'status': status,
      }),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to validate timesheet');
    }
  }
}