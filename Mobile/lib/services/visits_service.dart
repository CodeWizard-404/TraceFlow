import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/visit.dart';
import '../utils/constants.dart';

class VisitService {
  static Future<void> createVisit(Map<String, dynamic> visitData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/visits'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(visitData),
    );

    if (response.statusCode != 201) {
      throw Exception('Failed to create visit: ${response.body}');
    }
    return json.decode(response.body);
  }

  static Future<Visit> fetchVisitByID(String visitID) async {
    final response = await http.get(Uri.parse('$baseUrl/visits/$visitID'));
    if (response.statusCode == 200) {
      return Visit.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to load visit details');
    }
  }

  static Future<Map<String, dynamic>> verifyQRCode({
    required String qrData,
    required String visitId,
  }) async {
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

  static Future<Visit> logVisit(String visitId, Map<String, dynamic> logData) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/visits/$visitId/log'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(logData),
      );

      if (response.statusCode == 200) {
        return Visit.fromJson(json.decode(response.body));
      } else {
        throw Exception('Failed to log visit: ${response.body}');
      }
    } catch (error) {
      throw Exception('Failed to log visit: $error');
    }
  }
}