import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/receipt_stub.dart';
import '../utils/constants.dart';

class ReceiptStubService {
  static Future<void> collectStub(String bookID, String token) async {
    final response = await http.post(
      Uri.parse('$baseUrl/receipt-stubs/$bookID/collect'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to collect stub: ${response.body}');
    }
  }

  static Future<ReceiptStub> validateStubCollection(String bookID, String otpCode, String token) async {
    final response = await http.post(
      Uri.parse('$baseUrl/receipt-stubs/$bookID/validate-collection'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({'otpCode': otpCode}),
    );
    if (response.statusCode == 200) {
      return ReceiptStub.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to validate stub collection: ${response.body}');
    }
  }
}