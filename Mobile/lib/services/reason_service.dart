
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/reason.dart';
import '../utils/constants.dart';

class ReasonService {
  static Future<List<Reason>> getReasonsByVisitId(String visitId) async {
    final response = await http.get(Uri.parse('$baseUrl/visits/$visitId/reasons'));
    if (response.statusCode == 200) {
      List<dynamic> data = json.decode(response.body);
      return data.map((json) => Reason.fromJson(json)).toList();
    } else {
      throw Exception('Failed to fetch reasons');
    }
  }

  static Future<Reason> createReasonItem(String text) async {
    final response = await http.post(
      Uri.parse('$baseUrl/reasons'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'text': text}),
    );
    return Reason.fromJson(json.decode(response.body));
  }
}