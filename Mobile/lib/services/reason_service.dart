import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/reason.dart';
import '../utils/constants.dart';

class ReasonService {
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