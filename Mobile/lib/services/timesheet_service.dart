import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/timesheet.dart';
import '../utils/constants.dart';

class TimesheetService {
  static Future<Timesheet> createTimesheet({
    required int weekNumber,
    required int year,
    required String supervisorID,
    required List<Map<String, dynamic>> visits,
    required String token,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/timesheets'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'weekNumber': weekNumber,
        'year': year,
        'supervisorID': supervisorID,
        'visits': visits,
        'status': 'pending',
      }),
    );
    if (response.statusCode == 201) {
      return Timesheet.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to create timesheet: ${response.body}');
    }
  }

  static Future<List<Timesheet>> fetchTimesheetsBySupervisor(String supervisorID, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/timesheets/supervisor/$supervisorID'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final List<dynamic> decodedData = json.decode(response.body);
      return decodedData.map((json) => Timesheet.fromJson(json)).toList();
    } else {
      throw Exception('Failed to fetch timesheets: ${response.body}');
    }
  }

  static Future<Timesheet> fetchTimesheetById(String id, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/timesheets/$id'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return Timesheet.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to fetch timesheet: ${response.body}');
    }
  }
}