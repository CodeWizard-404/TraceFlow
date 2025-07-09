import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/receipt_stub.dart';
import '../utils/constants.dart';
import '../services/cookie_manager.dart';

class ReceiptStubService {
  Future<void> collectStub(List<String> bookIDs) async {
    if (kDebugMode) print('ReceiptStubService: Collecting stubs for books: $bookIDs');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.post(
        Uri.parse('$baseUrl/receipt-stubs/collect'),
        headers: headers,
        body: json.encode({'bookIDs': bookIDs}),
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        if (kDebugMode) print('Stubs collected successfully');
      } else {
        final error = json.decode(response.body)['error'] ?? 'Failed to collect stubs: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error collecting stubs: $e');
      throw Exception('Error collecting stubs: $e');
    }
  }

  Future<void> validateStubCollection(List<String> bookIDs, String otpCode) async {
    if (kDebugMode) print('ReceiptStubService: Validating stub collection for books: $bookIDs');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.post(
        Uri.parse('$baseUrl/receipt-stubs/validate-collection'),
        headers: headers,
        body: json.encode({'bookIDs': bookIDs, 'otpCode': otpCode}),
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        if (kDebugMode) print('Stubs validated successfully');
      } else {
        final error = json.decode(response.body)['error'] ?? 'Failed to validate stub collection: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error validating stub collection: $e');
      throw Exception('Error validating stub collection: $e');
    }
  }
}