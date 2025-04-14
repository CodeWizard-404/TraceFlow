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
    ).then((data) {
      if (data is Map<String, dynamic>) {
        return Visit.fromJson(data);
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
    ).then((data) {
      if (data is Map<String, dynamic>) {
        return Visit.fromJson(data);
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
    List<Map<String, dynamic>>? checklists,
    List<Map<String, dynamic>>? reasons,
    List<String>? photoPaths,
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
        if (checklists != null) request.fields['checklists'] = json.encode(checklists);
        if (reasons != null) request.fields['reasons'] = json.encode(reasons);

        if (photoPaths != null && photoPaths.isNotEmpty) {
          if (photoPaths.any((path) => !path.startsWith('/uploads/photos'))) {
            for (var path in photoPaths) {
              request.files.add(
                await http.MultipartFile.fromPath(
                  'photos',
                  path,
                  contentType: MediaType('image', 'jpeg'),
                ),
              );
            }
          } else {
            request.fields['photosToRemove'] = json.encode(photoPaths);
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
    ).then((data) {
      if (data is Map<String, dynamic>) {
        return Visit.fromJson(data);
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
        if (response.statusCode == 200) {
          return response;
        }
        throw Exception('Failed to verify QR code: ${response.body}');
      },
    ).then((data) {
      if (data is Map<String, dynamic>) {
        return data;
      }
      throw Exception('Invalid QR code response format');
    });
  }
}