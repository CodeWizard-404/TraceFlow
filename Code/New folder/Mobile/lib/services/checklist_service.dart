import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/checklist.dart';
import '../utils/constants.dart';
import '../services/cookie_manager.dart';

class ChecklistService {
  Future<List<Checklist>> getChecklistsByVisitId(String visitId) async {
    if (kDebugMode) print('ChecklistService: Fetching checklists for visit ID: $visitId');
    try {
      final headers = CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/checklists/visit/$visitId'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final checklists = data.map((json) => Checklist.fromJson(json)).toList();
        if (kDebugMode) print('Checklists fetched: ${checklists.length}');
        return checklists;
      } else if (response.statusCode == 404) {
        if (kDebugMode) print('No checklists found for visit: $visitId');
        return [];
      } else {
        final error = 'Failed to fetch checklists: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching checklists: $e');
      throw Exception('Error fetching checklists: $e');
    }
  }

  Future<List<Checklist>> getAllChecklists() async {
    if (kDebugMode) print('ChecklistService: Fetching all checklists');
    try {
      final headers = CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/checklists'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final checklists = data.map((json) => Checklist.fromJson(json)).toList();
        if (kDebugMode) print('Checklists fetched: ${checklists.length}');
        return checklists;
      } else {
        final error = 'Failed to fetch all checklists: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching all checklists: $e');
      throw Exception('Error fetching all checklists: $e');
    }
  }
}