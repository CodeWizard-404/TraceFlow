// lib/services/reason_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/reason.dart';
import '../utils/constants.dart';

class ReasonService {
  // Create a new reason item
  static Future<Reason> createReasonItem(String text, String token) async {
    final response = await http.post(
      Uri.parse('$baseUrl/reasons'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({'text': text}),
    );
    if (response.statusCode == 201) {
      return Reason.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to create reason: ${response.body}');
    }
  }

  // Fetch reasons by visit ID
  static Future<List<Reason>> getReasonsByVisitId(String visitId, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/reasons/$visitId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      List<dynamic> data = json.decode(response.body);
      return data.map((json) => Reason.fromJson(json)).toList();
    } else {
      throw Exception('Failed to fetch reasons: ${response.body}');
    }
  }

  // Fetch all reasons (for reference if needed)
  static Future<List<Reason>> getAllReasons(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/reasons'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      List<dynamic> data = json.decode(response.body);
      return data.map((json) => Reason.fromJson(json)).toList();
    } else {
      throw Exception('Failed to fetch all reasons: ${response.body}');
    }
  }
}