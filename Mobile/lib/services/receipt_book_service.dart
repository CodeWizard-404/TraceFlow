import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/receipt_book.dart';
import '../utils/constants.dart';
import '../services/cookie_manager.dart';

class ReceiptBookService {
  Future<List<ReceiptBook>> fetchAllReceiptBooks() async {
    if (kDebugMode) print('ReceiptBookService: Fetching all receipt books');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/receipt-books'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final books = data.map((json) => ReceiptBook.fromJson(json)).toList();
        if (kDebugMode) print('Receipt books fetched: ${books.length}');
        return books;
      } else {
        final error = 'Failed to fetch receipt books: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching receipt books: $e');
      throw Exception('Error fetching receipt books: $e');
    }
  }

  Future<ReceiptBook?> fetchReceiptBookById(String bookID) async {
    if (kDebugMode) print('ReceiptBookService: Fetching receipt book by ID: $bookID');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/receipt-books/$bookID'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final book = ReceiptBook.fromJson(data);
        if (kDebugMode) print('Receipt book fetched: ${book.bookID}');
        return book;
      } else if (response.statusCode == 404) {
        if (kDebugMode) print('No receipt book found for ID: $bookID');
        return null;
      } else {
        final error = 'Failed to fetch receipt book: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching receipt book by ID: $e');
      throw Exception('Error fetching receipt book: $e');
    }
  }

  Future<ReceiptBook?> fetchReceiptBookByNumber(String number) async {
    if (kDebugMode) print('ReceiptBookService: Fetching receipt book by number: $number');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/receipt-books/number/$number'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final book = ReceiptBook.fromJson(data);
        if (kDebugMode) print('Receipt book fetched: ${book.bookID}');
        return book;
      } else if (response.statusCode == 404) {
        if (kDebugMode) print('No receipt book found for number: $number');
        return null;
      } else {
        final error = 'Failed to fetch receipt book: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching receipt book by number: $e');
      throw Exception('Error fetching receipt book: $e');
    }
  }

  Future<void> transferReceiptBooks({
    required List<String> bookIDs,
    required String recipientID,
    required String recipientType,
  }) async {
    if (kDebugMode) print('ReceiptBookService: Transferring receipt books: $bookIDs');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.post(
        Uri.parse('$baseUrl/receipt-books/transfer'),
        headers: headers,
        body: json.encode({
          'bookIDs': bookIDs,
          'recipientID': recipientID,
          'recipientType': recipientType,
        }),
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        if (kDebugMode) print('Receipt books transferred successfully');
      } else {
        final error = json.decode(response.body)['error'] ?? 'Failed to transfer receipt books: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error transferring receipt books: $e');
      throw Exception('Error transferring receipt books: $e');
    }
  }

  Future<void> validateTransfer({
    required List<String> bookIDs,
    required String recipientID,
    required String otpCode,
    required String recipientType,
  }) async {
    if (kDebugMode) print('ReceiptBookService: Validating transfer for books: $bookIDs');
    try {
      final headers = await CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.post(
        Uri.parse('$baseUrl/receipt-books/validate-transfer'),
        headers: headers,
        body: json.encode({
          'bookIDs': bookIDs,
          'recipientID': recipientID,
          'otpCode': otpCode,
          'recipientType': recipientType,
        }),
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        if (kDebugMode) print('Transfer validated successfully');
      } else {
        final error = json.decode(response.body)['error'] ?? 'Failed to validate transfer: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error validating transfer: $e');
      throw Exception('Error validating transfer: $e');
    }
  }
}