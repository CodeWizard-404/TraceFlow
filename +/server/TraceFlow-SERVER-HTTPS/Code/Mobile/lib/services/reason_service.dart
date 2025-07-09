import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/reason.dart';
import '../utils/constants.dart';
import '../services/cookie_manager.dart';

class ReasonService {
  Future<List<Reason>> getReasonsByVisitId(String visitId) async {
    if (kDebugMode) print('ReasonService: Fetching reasons for visit ID: $visitId');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/visits/$visitId/reasons'), // Updated endpoint
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final reasons = data.map((json) => Reason.fromJson(json)).toList();
        if (kDebugMode) print('Reasons fetched: ${reasons.length}');
        return reasons;
      } else if (response.statusCode == 404) {
        if (kDebugMode) print('No reasons found for visit: $visitId');
        return [];
      } else {
        final error = 'Failed to fetch reasons: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching reasons: $e');
      throw Exception('Error fetching reasons: $e');
    }
  }

  Future<List<Reason>> getAllReasons() async {
    if (kDebugMode) print('ReasonService: Fetching all reasons');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/reasons'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final reasons = data.map((json) => Reason.fromJson(json)).toList();
        if (kDebugMode) print('Reasons fetched: ${reasons.length}');
        return reasons;
      } else {
        final error = 'Failed to fetch all reasons: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching all reasons: $e');
      throw Exception('Error fetching all reasons: $e');
    }
  }
}