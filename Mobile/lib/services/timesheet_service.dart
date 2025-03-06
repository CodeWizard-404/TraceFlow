import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/timesheet.dart';
import '../utils/constants.dart';

class TimesheetService {
  // Fetch all timesheets
  static Future<List<Timesheet>> fetchAllTimesheets() async {
      final response = await http.get(Uri.parse('$baseUrl/timesheets'));
      if (response.statusCode == 200) {
        final List<dynamic> decodedData = json.decode(response.body);
        return decodedData.map((json) => Timesheet.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load timesheets: ${response.statusCode}');
      }

  }

  // Create a new timesheet or add visits to an existing one
  static Future<http.Response> createTimesheet(Map<String, dynamic> payload) async {
    for (var visit in payload['visits']) {
      visit['checklist'] = visit['checklistItems'];
      visit.remove('checklistItems');
    }

    final response = await http.post(
      Uri.parse('$baseUrl/timesheets'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(payload),
    );
    return response;
  }

  // Fetch a specific timesheet by ID
  static Future<Timesheet> fetchTimesheetById(String id) async {
    final response = await http.get(Uri.parse('$baseUrl/timesheets/$id'));
    print('API Response: ${response.body}'); // Add this line
    if (response.statusCode == 200) {
      return Timesheet.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to fetch timesheet');
    }
  }

  // Validate a timesheet (fully or partially)
  static Future<void> validateTimesheet(String id, List<String> visitIDs, String status) async {
    final response = await http.put(
      Uri.parse('$baseUrl/timesheets/$id/validate'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'visitIDs': visitIDs,
        'status': status,
      }),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to validate timesheet');
    }
  }

  // Fetch timesheets by supervisor
  static Future<List<Timesheet>> fetchTimesheetsBySupervisor(String supervisorID) async {
      final response = await http.get(Uri.parse('$baseUrl/timesheets/supervisor/$supervisorID'));
      if (response.statusCode == 200) {
        final List<dynamic> decodedData = json.decode(response.body);
        return decodedData.map((json) => Timesheet.fromJson(json)).toList();
      } else {
        throw Exception('Failed to fetch timesheets by supervisor: ${response.statusCode}');
      }

  }
}