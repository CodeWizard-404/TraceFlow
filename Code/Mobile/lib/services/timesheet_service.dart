import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/timesheet.dart';
import '../utils/constants.dart';
import './auth_service.dart';
import './cookie_manager.dart';

class TimesheetService {


  static Future<Timesheet> createTimesheetForSupervisor({
    required int weekNumber,
    required int year,
    required String supervisorID,
    required List<Map<String, dynamic>> visits,
    String status = 'pending',
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
            'status': status,
          }),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 201) {
          return response;
        }
        throw Exception('Failed to create timesheet: ${response.body}');
      },
    ).then((data) {
      return Timesheet.fromJson(data['timesheet']);
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
    ).then((data) {
      return Timesheet.fromJson(data);
    });
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
      // 'data' is the parsed JSON from makeAuthenticatedRequest
      if (data is List) {
        return data.map((item) => Timesheet.fromJson(item)).toList();
      }
      throw Exception('Invalid timesheets response format');
    }).catchError((e) {
      if (kDebugMode) print('Fetch timesheets error: $e');
      throw e;
    });
  }

  static Future<Timesheet> fetchTimesheetByWeekAndYear({
    required int weekNumber,
    required int year,
    required String supervisorID,
  }) async {
    if (kDebugMode) print('Fetching timesheet for week: $weekNumber, year: $year, supervisor: $supervisorID');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/timesheets/week/$weekNumber/year/$year/supervisor/$supervisorID');
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
    ).then((data) {
    return Timesheet.fromJson(data);
    });
  }

  static Future<Map<String, dynamic>> suggestTimesheet({
    required String supervisorID,
    required int weekNumber,
    required int year,
    required Map<String, dynamic> coordinates,
    Map<String, dynamic>? criteria,
  }) async {
    if (kDebugMode) print('Suggesting timesheet for supervisor: $supervisorID');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/timesheets/suggest');
        if (kDebugMode) print('POST $url');
        final response = await http.post(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          body: json.encode({
            'supervisorID': supervisorID,
            'weekNumber': weekNumber,
            'year': year,
            'coordinates': coordinates,
            'criteria': criteria ?? {},
          }),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to suggest timesheet: ${response.body}');
      },
    ).then((response) {
      final data = json.decode(response.body);
      if (data is Map<String, dynamic>) {
        return data;
      }
      throw Exception('Invalid timesheet suggestion response format');
    });
  }

  static Future<void> cancelTimesheetSuggestion(String requestId) async {
    if (kDebugMode) print('Canceling timesheet suggestion: $requestId');
    await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/timesheets/suggest/cancel/$requestId');
        if (kDebugMode) print('POST $url');
        final response = await http.post(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to cancel timesheet suggestion: ${response.body}');
      },
    );
  }

  static Future<Map<String, dynamic>> syncTimesheetToCalendar(String timesheetId) async {
    if (kDebugMode) print('Syncing timesheet to calendar: $timesheetId');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/timesheets/$timesheetId/sync-calendar');
        if (kDebugMode) print('POST $url');
        final response = await http.post(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to sync timesheet to calendar: ${response.body}');
      },
    ).then((response) {
      final data = json.decode(response.body);
      if (data is Map<String, dynamic>) {
        return data;
      }
      throw Exception('Invalid calendar sync response format');
    });
  }
}