import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/timesheet.dart';
import '../models/visit.dart';
import '../utils/constants.dart';

class ApiService {
  // Fetch all timesheets
  static Future<List<dynamic>> getTimesheets() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/timesheets'));
      print('Status Code: ${response.statusCode}');
      print('Response Body: ${response.body}');

      if (response.statusCode == 200) {
        final decodedData = json.decode(response.body);
          return decodedData;

      } else {
        throw Exception('Failed to load timesheets: ${response.statusCode}');
      }
    } catch (e) {
      print('Exception: $e');
      rethrow;
    }
  }

  // Create a new timesheet or add visits to an existing one
  static Future<void> postTimesheet(Map<String, dynamic> timesheetData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/timesheets'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(timesheetData),
    );
    if (response.statusCode != 201) {
      throw Exception('Failed to create timesheet');
    }
  }

  // Fetch a specific timesheet by ID
  static Future<Map<String, dynamic>> getTimesheetById(String id) async {
    final response = await http.get(Uri.parse('$baseUrl/timesheets/$id'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to fetch timesheet');
    }
  }

  // Validate a timesheet (fully or partially)
  static Future<void> validateTimesheet(String id, Map<String, dynamic> validationData) async {
    final response = await http.put(
      Uri.parse('$baseUrl/timesheets/$id/validate'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(validationData),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to validate timesheet');
    }
  }

  // Create a new visit
  static Future<void> postVisit(Map<String, dynamic> visitData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/visits'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(visitData),
    );
    if (response.statusCode != 201) {
      throw Exception('Failed to create visit');
    }
  }

  // Log visit details
  static Future<void> logVisit(String visitId, Map<String, dynamic> logData) async {
    final response = await http.put(
      Uri.parse('$baseUrl/visits/$visitId/log'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(logData),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to log visit');
    }
  }
}