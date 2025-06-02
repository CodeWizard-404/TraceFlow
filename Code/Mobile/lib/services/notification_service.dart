import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';
import './auth_service.dart';
import './cookie_manager.dart';

class NotificationService {
  static Future<List<dynamic>> getRules() async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/rules');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch rules: ${response.statusCode}');
        },
      );
      return jsonDecode(response.body);
    } catch (e) {
      if (kDebugMode) print('Error fetching rules: $e');
      rethrow;
    }
  }

  static Future<List<String>> getNotificationTypes() async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/types');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch notification types: ${response.statusCode}');
        },
      );
      final data = jsonDecode(response.body);
      return List<String>.from(data['types']);
    } catch (e) {
      if (kDebugMode) print('Error fetching notification types: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> updatePreferences(Map<String, dynamic> preferences) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/preferences');
          final response = await http.put(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({'preferences': preferences}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to update preferences: ${response.statusCode}');
        },
      );
      return jsonDecode(response.body);
    } catch (e) {
      if (kDebugMode) print('Error updating preferences: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> getPreferences() async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/preferences');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch preferences: ${response.statusCode}');
        },
      );
      return jsonDecode(response.body);
    } catch (e) {
      if (kDebugMode) print('Error fetching preferences: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getNotifications() async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch notifications: ${response.statusCode}');
        },
      );
      return jsonDecode(response.body);
    } catch (e) {
      if (kDebugMode) print('Error fetching notifications: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> markNotificationAsRead(String notificationID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/$notificationID/read');
          final response = await http.put(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to mark notification as read: ${response.statusCode}');
        },
      );
      return jsonDecode(response.body);
    } catch (e) {
      if (kDebugMode) print('Error marking notification as read: $e');
      rethrow;
    }
  }

  static Future<void> markAllNotificationsAsRead() async {
    try {
      await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/read-all');
          final response = await http.put(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to mark all notifications as read: ${response.statusCode}');
        },
      );
    } catch (e) {
      if (kDebugMode) print('Error marking all notifications as read: $e');
      rethrow;
    }
  }
}