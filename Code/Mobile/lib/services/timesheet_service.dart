import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/timesheet.dart';
import '../utils/constants.dart';
import './auth_service.dart';
import './cookie_manager.dart';

class TimesheetService {
  static Future<Timesheet> createTimesheet({
    required int weekNumber,
    required int year,
    required String supervisorID,
    required List<Map<String, dynamic>> visits,
  }) async {
    if (kDebugMode) print('Creating timesheet for supervisor: $supervisorID');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/timesheets/supervisor');
        if (kDebugMode) print('POST $url');
        final response = await http.post(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          body: json.encode({
            'weekNumber': weekNumber,
            'year': year,
            'supervisorID': supervisorID,
            'visits': visits,
          }),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 201) {
          return response;
        }
        throw Exception('Failed to create timesheet: ${response.body}');
      },
    ).then((data) => Timesheet.fromJson(data));
  }

  static Future<List<Timesheet>> fetchTimesheetsBySupervisor(String supervisorID) async {
    if (kDebugMode) print('Fetching timesheets for supervisor: $supervisorID');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/timesheets/supervisor/$supervisorID');
        if (kDebugMode) print('GET $url');
        final response = await http.get(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to fetch timesheets: ${response.body}');
      },
    ).then((data) {
      if (kDebugMode) print('Parsed data: $data');
      return (data as List).map((item) => Timesheet.fromJson(item)).toList();
    }).catchError((e) {
      if (kDebugMode) print('Fetch timesheets error: $e');
      throw e;
    });
  }

  static Future<Timesheet> fetchTimesheetById(String id) async {
    if (kDebugMode) print('Fetching timesheet by ID: $id');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/timesheets/$id');
        if (kDebugMode) print('GET $url');
        final response = await http.get(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to fetch timesheet: ${response.body}');
      },
    ).then((data) => Timesheet.fromJson(data));
  }
}