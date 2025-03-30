import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../models/visit.dart';
import '../utils/constants.dart';

class VisitService {
  static Future<Visit> logVisit({
    required String visitId,
    required int duration,
    required List<Map<String, dynamic>> checklistUpdates,
    String? comment,
    List<String>? photoPaths,
    required String token,
  }) async {
    var request = http.MultipartRequest(
      'PUT',
      Uri.parse('$baseUrl/visits/$visitId/log'),
    );
    request.headers['Authorization'] = 'Bearer $token';
    request.fields['duration'] = duration.toString();
    request.fields['checklistUpdates'] = json.encode(checklistUpdates);
    if (comment != null) request.fields['comment'] = comment;
    if (photoPaths != null) {
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
    final response = await request.send();
    final responseBody = await response.stream.bytesToString();
    if (response.statusCode == 200) {
      return Visit.fromJson(json.decode(responseBody));
    } else {
      throw Exception('Failed to log visit: $responseBody');
    }
  }

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
    List<String>? photoPaths, // Used for both new photos and photos to remove
    required String token,
  }) async {
    var request = http.MultipartRequest(
      'PUT',
      Uri.parse('$baseUrl/visits/$visitId'),
    );
    request.headers['Authorization'] = 'Bearer $token';

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
      // If paths are from camera (local files), send as multipart files
      if (photoPaths.any((path) => !path.startsWith('/uploads/photos'))) {
        for (var path in photoPaths) {
          request.files.add(
            await http.MultipartFile.fromPath(
              'photos', // Match backend expectation
              path,
              contentType: MediaType('image', 'jpeg'),
            ),
          );
        }
      } else {
        // If paths are server paths (to remove), send as photosToRemove
        request.fields['photosToRemove'] = json.encode(photoPaths);
      }
    }

    final response = await request.send();
    final responseBody = await response.stream.bytesToString();

    if (response.statusCode == 200) {
      return Visit.fromJson(json.decode(responseBody));
    } else {
      throw Exception('Failed to update visit: $responseBody');
    }
  }

  static Future<void> deleteVisit(String visitId, String token) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/visits/$visitId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to delete visit: ${response.body}');
    }
  }

  static Future<Map<String, dynamic>> verifyQRCode({
    required String qrData,
    required String visitId,
    required String token,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/visits/verify-qr'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({'qrData': qrData, 'visitId': visitId}),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to verify QR code: ${response.body}');
    }
  }
}
