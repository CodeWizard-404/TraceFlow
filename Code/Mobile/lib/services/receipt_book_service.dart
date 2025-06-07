import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/receipt_book.dart';
import '../models/receipt_book_type.dart';
import '../utils/constants.dart';
import '../services/cookie_manager.dart';

class ReceiptBookService {
  Future<List<ReceiptBook>> fetchAllReceiptBooks({
    int page = 1,
    int limit = 10,
    String sortField = 'number',
    String sortOrder = 'ASC',
    String searchQuery = '',
    String filterType = 'all',
    String filterStatus = 'all',
  }) async {
    if (kDebugMode) print('ReceiptBookService: Fetching all receipt books with page: $page, limit: $limit');
    try {
      final headers = CookieManager.getHeaders();
      final queryParams = {
        'page': page.toString(),
        'limit': limit.toString(),
        'sortField': sortField,
        'sortOrder': sortOrder,
        'searchQuery': searchQuery,
        'filterType': filterType,
        'filterStatus': filterStatus,
      };
      final uri = Uri.parse('$baseUrl/receipt-books').replace(queryParameters: queryParams);
      if (kDebugMode) print('GET $uri');
      final response = await http.get(uri, headers: headers);

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final books = (data['books'] as List).map((json) => ReceiptBook.fromJson(json)).toList();
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
      final headers = CookieManager.getHeaders();
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
      final headers = CookieManager.getHeaders();
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

  Future<List<ReceiptBook>> getReceiptBooksByHolder(String holderID, String holderType) async {
    if (kDebugMode) print('ReceiptBookService: Fetching receipt books for holder: $holderID ($holderType)');
    try {
      final headers = {
        ...CookieManager.getHeaders(),
        'Content-Type': 'application/json',
      };
      final response = await http.post(
        Uri.parse('$baseUrl/receipt-books/holder/$holderID'),
        headers: headers,
        body: json.encode({
          'userType': holderType,
        }),
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (kDebugMode) print('Response body: ${response.body}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final books = (data is List ? data : [data]).map((json) => ReceiptBook.fromJson(json)).toList();
        if (kDebugMode) print('Receipt books fetched: ${books.length} for holder: $holderID');
        return books;
      } else {
        final error = json.decode(response.body)['error'] ?? 'Failed to fetch receipt books: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching receipt books by holder: $e');
      throw Exception('Error fetching receipt books by holder: $e');
    }
  }

  Future<void> transferReceiptBooks({
    required List<String> bookIDs,
    required String recipientID,
    required String recipientType,
  }) async {
    if (kDebugMode) print('ReceiptBookService: Transferring receipt books: $bookIDs to $recipientID ($recipientType)');
    try {
      final headers = {
        ...CookieManager.getHeaders(),
        'Content-Type': 'application/json',
      };
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
    if (kDebugMode) print('ReceiptBookService: Validating transfer for books: $bookIDs to $recipientID ($recipientType)');
    try {
      final headers = {
        ...CookieManager.getHeaders(),
        'Content-Type': 'application/json',
      };
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

  Future<List<ReceiptBookType>> getAllReceiptBookTypes() async {
    if (kDebugMode) print('ReceiptBookService: Fetching all receipt book types');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/receipt-books/types'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final types = data.map((json) => ReceiptBookType.fromJson(json)).toList();
        if (kDebugMode) print('Receipt book types fetched: ${types.length}');
        return types;
      } else {
        final error = 'Failed to fetch receipt book types: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching receipt book types: $e');
      throw Exception('Error fetching receipt book types: $e');
    }
  }
}