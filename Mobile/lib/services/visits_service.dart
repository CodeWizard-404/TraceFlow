import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/visit.dart';
import '../utils/constants.dart';

class VisitService {
  // Create a new visit
  static Future<void> createVisit(Map<String, dynamic> visitData) async {

    visitData['checklist'] = visitData['checklistItems'];
    visitData.remove('checklistItems');

    final response = await http.post(
      Uri.parse('$baseUrl/visits'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(visitData),
    );
  return json.decode(response.body);
  }

  // Fetch a visit by its ID
  static Future<Map<String, dynamic>> fetchVisitByID(String visitID) async {
    final response = await http.get(Uri.parse('$baseUrl/visits/$visitID'));
      return json.decode(response.body);
  }

  // Add new verification method
  static Future<Map<String, dynamic>> verifyQRCode({required String qrData,required String visitId}) async {
        final response = await http.post(
          Uri.parse('$baseUrl/visits/verify-qr'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode({
            'qrData': qrData,
            'visitId': visitId,
          }),
        );
        return json.decode(response.body);
  }

  // Log visit details
// services/visit_service.dart
  static Future<Visit> logVisit(String visitId, Map<String, dynamic> logData) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/visits/$visitId/log'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(logData),
      );

      if (response.statusCode == 200) {
        return Visit.fromJson(json.decode(response.body)); // Return parsed Visit
      } else {
        throw Exception('Failed to log visit: ${response.body}');
      }
    } catch (error) {
      throw Exception('Failed to log visit: $error');
    }
  }
}