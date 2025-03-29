// lib/services/receipt_book_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/receipt_book.dart';
import '../utils/constants.dart';

class ReceiptBookService {
  // Fetch all receipt books from the backend
  static Future<List<ReceiptBook>> fetchAllReceiptBooks(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/receipt-books'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final List<dynamic> decodedData = json.decode(response.body);
      return decodedData.map((json) => ReceiptBook.fromJson(json)).toList();
    } else {
      throw Exception('Failed to fetch all receipt books: ${response.body}');
    }
  }

  static Future<ReceiptBook> fetchReceiptBookById(String bookID, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/receipt-books/$bookID'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return ReceiptBook.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to fetch receipt book: ${response.body}');
    }
  }

  static Future<void> transferReceiptBooks({
    required List<String> bookIDs,
    required String recipientID,
    required String recipientType,
    required String token,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/receipt-books/transfer'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'bookIDs': bookIDs,
        'recipientID': recipientID,
        'recipientType': recipientType,
      }),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to transfer receipt books: ${response.body}');
    }
  }

  static Future<ReceiptBook> validateTransfer({
    required List<String> bookIDs,
    required String recipientID,
    required String otpCode,
    required String recipientType,
    required String token,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/receipt-books/validate-transfer'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'bookIDs': bookIDs,
        'recipientID': recipientID,
        'otpCode': otpCode,
        'recipientType': recipientType,
      }),
    );
    if (response.statusCode == 200) {
      return ReceiptBook.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to validate transfer: ${response.body}');
    }
  }
}