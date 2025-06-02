import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../models/visit.dart';
import '../utils/constants.dart';
import './auth_service.dart';
import './cookie_manager.dart';

class VisitService {
  static Future<Visit> logVisit({
    required String visitId,
    required int duration,
    required List<Map<String, dynamic>> checklistUpdates,
    String? comment,
    String? date,
    String? time,
    String? status,
    List<String>? photoPaths,
  }) async {
    if (kDebugMode) print('VisitService.logVisit called for visitId: $visitId');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        var request = http.MultipartRequest(
          'PUT',
          Uri.parse('$baseUrl/visits/$visitId/log'),
        );
        request.headers.addAll(CookieManager.getHeaders({'Content-Type': 'multipart/form-data'}));
        request.fields['duration'] = duration.toString();
        request.fields['checklistUpdates'] = json.encode(checklistUpdates);
        if (comment != null) request.fields['comment'] = comment;
        if (date != null) request.fields['date'] = date;
        if (time != null) request.fields['time'] = time;
        if (status != null) request.fields['status'] = status;
        if (photoPaths != null && photoPaths.isNotEmpty) {
          for (var path in photoPaths) {
            request.files.add(
              await http.MultipartFile.fromPath(
                'photos',
                path,
                contentType: MediaType('image', 'jpeg'),
              ),
            );
          }
        }
        if (kDebugMode) print('Sending multipart request to $baseUrl/visits/$visitId/log');
        final response = await request.send();
        final responseBody = await response.stream.bytesToString();
        final httpResponse = http.Response(responseBody, response.statusCode, headers: response.headers);
        if (kDebugMode) print('Response: ${response.statusCode}, $responseBody');
        CookieManager.extractCookies(httpResponse);
        if (response.statusCode == 200) {
          return httpResponse;
        }
        throw Exception('Failed to log visit: $responseBody');
      },
    ).then((response) {
      if (response is Map<String, dynamic>) {
        return Visit.fromJson(response['visit'] ?? response);
      }
      throw Exception('Invalid visit response format');
    });
  }

  static Future<Visit> fetchVisitById(String visitId) async {
    if (kDebugMode) print('VisitService.fetchVisitById called for visitId: $visitId');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/visits/$visitId');
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
        throw Exception('Failed to fetch visit: ${response.body}');
      },
    ).then((response) {
      if (response is Map<String, dynamic>) {
        return Visit.fromJson(response);
      }
      throw Exception('Invalid visit response format');
    });
  }

  static Future<Visit> updateVisit({
    required String visitId,
    String? date,
    String? time,
    int? duration,
    String? location,
    String? status,
    String? comment,
    String? agentID,
    String? supervisorID,
    List<Map<String, dynamic>>? checklists,
    List<Map<String, dynamic>>? reasons,
    List<String>? photoPaths,
    List<String>? photosToRemove,
  }) async {
    if (kDebugMode) print('VisitService.updateVisit called for visitId: $visitId');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        var request = http.MultipartRequest(
          'PUT',
          Uri.parse('$baseUrl/visits/$visitId'),
        );
        request.headers.addAll(CookieManager.getHeaders({'Content-Type': 'multipart/form-data'}));

        if (date != null) request.fields['date'] = date;
        if (time != null) request.fields['time'] = time;
        if (duration != null) request.fields['duration'] = duration.toString();
        if (location != null) request.fields['location'] = location;
        if (status != null) request.fields['status'] = status;
        if (comment != null) request.fields['comment'] = comment;
        if (agentID != null) request.fields['agentID'] = agentID;
        if (supervisorID != null) request.fields['supervisorID'] = supervisorID;
        if (checklists != null) request.fields['checklists'] = json.encode(checklists);
        if (reasons != null) request.fields['reasons'] = json.encode(reasons);
        if (photosToRemove != null) request.fields['photosToRemove'] = json.encode(photosToRemove);

        if (photoPaths != null && photoPaths.isNotEmpty) {
          for (var path in photoPaths.where((path) => !path.startsWith('/uploads/photos'))) {
            request.files.add(
              await http.MultipartFile.fromPath(
                'photos',
                path,
                contentType: MediaType('image', 'jpeg'),
              ),
            );
          }
        }

        if (kDebugMode) print('Sending multipart request to $baseUrl/visits/$visitId');
        final response = await request.send();
        final responseBody = await response.stream.bytesToString();
        final httpResponse = http.Response(responseBody, response.statusCode, headers: response.headers);
        if (kDebugMode) print('Response: ${response.statusCode}, $responseBody');
        CookieManager.extractCookies(httpResponse);
        if (response.statusCode == 200) {
          return httpResponse;
        }
        throw Exception('Failed to update visit: $responseBody');
      },
    ).then((response) {
      if (response is Map<String, dynamic>) {
        return Visit.fromJson(response['visit'] ?? response);
      }
      throw Exception('Invalid visit response format');
    });
  }

  static Future<void> deleteVisit(String visitId) async {
    if (kDebugMode) print('VisitService.deleteVisit called for visitId: $visitId');
    await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/visits/$visitId');
        if (kDebugMode) print('DELETE $url');
        final response = await http.delete(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to delete visit: ${response.body}');
      },
    );
  }

  static Future<Map<String, dynamic>> verifyQRCode({
    required String qrData,
    required String visitId,
  }) async {
    if (kDebugMode) print('VisitService.verifyQRCode called for visitId: $visitId');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/visits/verify-qr');
        if (kDebugMode) print('POST $url');
        final response = await http.post(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          body: json.encode({'qrData': qrData, 'visitId': visitId}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200 || response.statusCode == 400) {
          return response;
        }
        throw Exception('Failed to verify QR code: ${response.body}');
      },
    ).then((response) {
      if (response is Map<String, dynamic>) {
        return response;
      }
      throw Exception('Invalid QR code response format');
    });
  }

  static Future<Map<String, dynamic>> validateOTP({
    required String visitId,
    required String otpCode,
  }) async {
    if (kDebugMode) print('VisitService.validateOTP called for visitId: $visitId');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/visits/$visitId/validate-otp');
        if (kDebugMode) print('POST $url');
        final response = await http.post(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          body: json.encode({'visitId': visitId, 'otpCode': otpCode}),
        );
        if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
        CookieManager.extractCookies(response);
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to validate OTP: ${response.body}');
      },
    ).then((response) {
      if (response is Map<String, dynamic>) {
        return response;
      }
      throw Exception('Invalid OTP response format');
    });
  }

  static Future<Map<String, dynamic>> syncVisitToCalendar(String visitId) async {
    if (kDebugMode) print('VisitService.syncVisitToCalendar called for visitId: $visitId');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/visits/$visitId/sync-calendar');
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
        throw Exception('Failed to sync visit to calendar: ${response.body}');
      },
    ).then((response) {
      if (response is Map<String, dynamic>) {
        return response;
      }
      throw Exception('Invalid calendar sync response format');
    });
  }

  static Future<List<Map<String, dynamic>>> listCalendarEvents(String timesheetId) async {
    if (kDebugMode) print('VisitService.listCalendarEvents called for timesheetId: $timesheetId');
    return await AuthService.makeAuthenticatedRequest(
      request: () async {
        final url = Uri.parse('$baseUrl/visits/timesheet/$timesheetId/calendar-events');
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
        throw Exception('Failed to list calendar events: ${response.body}');
      },
    ).then((response) {
      if (response is List) {
        return response.cast<Map<String, dynamic>>();
      }
      throw Exception('Invalid calendar events response format');
    });
  }
}