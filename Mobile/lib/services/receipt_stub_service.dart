import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/receipt_stub.dart';
import '../utils/constants.dart';
import '../services/cookie_manager.dart';

class ReceiptStubService {
  Future<void> collectStub(String bookID) async {
    if (kDebugMode) print('ReceiptStubService: Collecting stub for book: $bookID');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.post(
        Uri.parse('$baseUrl/receipt-stubs/$bookID/collect'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        if (kDebugMode) print('Stub collected successfully');
      } else {
        final error = 'Failed to collect stub: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error collecting stub: $e');
      throw Exception('Error collecting stub: $e');
    }
  }

  Future<ReceiptStub?> validateStubCollection(String bookID, String otpCode) async {
    if (kDebugMode) print('ReceiptStubService: Validating stub collection for book: $bookID');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.post(
        Uri.parse('$baseUrl/receipt-stubs/$bookID/validate-collection'),
        headers: headers,
        body: json.encode({'otpCode': otpCode}),
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final stub = ReceiptStub.fromJson(data);
        if (kDebugMode) print('Stub validated: ${stub.stubID}');
        return stub;
      } else if (response.statusCode == 404) {
        if (kDebugMode) print('No stub found for book: $bookID');
        return null;
      } else {
        final error = 'Failed to validate stub collection: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error validating stub collection: $e');
      throw Exception('Error validating stub collection: $e');
    }
  }
}