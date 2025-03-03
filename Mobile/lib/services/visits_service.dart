import 'package:http/http.dart' as http;
import 'dart:convert';
import '../utils/constants.dart';

class VisitService {
  // Create a new visit
  static Future<void> createVisit(Map<String, dynamic> visitData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/visits'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(visitData),
    );
    if (response.statusCode != 201) {
      throw Exception('Failed to create visit');
    }
  }

  // Fetch a visit by its ID
  static Future<Map<String, dynamic>> fetchVisitByID(String visitID) async {
    final response = await http.get(Uri.parse('$baseUrl/visits/$visitID'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to fetch visit');
    }
  }

  // Add new verification method
    static Future<Map<String, dynamic>> verifyQRCode({
      required String qrData,
      required String visitId,
    }) async {
      try {
        final response = await http.post(
          Uri.parse('$baseUrl/visits/verify-qr'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode({
            'qrData': qrData,
            'visitId': visitId,
          }),
        );

        if (response.statusCode == 200) {
          return json.decode(response.body);
        } else {
          throw Exception('Verification failed: ${response.body}');
        }
      } catch (error) {
        throw Exception('Verification error: $error');
      }
    }

  // Log visit details
  static Future<void> logVisit(String visitId, Map<String, dynamic> logData) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/visits/$visitId/log'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(logData),
      );

      if (response.statusCode != 200) {
        // Log the response body for debugging
        print('Error logging visit: ${response.body}');
        throw Exception('Failed to log visit: ${response.body}');
      }
    } catch (error) {
      // Log any exceptions
      print('Exception in logVisit: $error');
      rethrow;
    }
  }
}