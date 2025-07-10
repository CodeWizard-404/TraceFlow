import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';
import './auth_service.dart';
import './cookie_manager.dart';

class NotificationService {
  static Future<List<dynamic>> getRules() async {
    try {
      if (kDebugMode) print('NotificationService: Starting getRules request at ${DateTime.now().toIso8601String()}');
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/rules');
          if (kDebugMode) print('NotificationService: Sending GET request to $url with headers: ${CookieManager.getHeaders({'Content-Type': 'application/json'})}');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          if (kDebugMode) {
            print('NotificationService: getRules Response status code: ${response.statusCode}');
            print('NotificationService: getRules Response headers: ${response.headers}');
            print('NotificationService: getRules Response body (raw): ${response.body}');
          }
          CookieManager.extractCookies(response);
          return response;
        },
      );
      if (kDebugMode) {
        print('NotificationService: getRules Response type: ${response.runtimeType}');
        print('NotificationService: getRules Response: $response');
      }
      return response is List ? response : response['rules'] ?? [];
    } catch (e, stackTrace) {
      if (kDebugMode) {
        print('NotificationService: Error fetching rules: $e');
        print('NotificationService: getRules Stack trace: $stackTrace');
      }
      rethrow;
    }
  }

  static Future<List<String>> getNotificationTypes() async {
    try {
      if (kDebugMode) print('NotificationService: Starting getNotificationTypes request at ${DateTime.now().toIso8601String()}');
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/types');
          if (kDebugMode) print('NotificationService: Sending GET request to $url with headers: ${CookieManager.getHeaders({'Content-Type': 'application/json'})}');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          if (kDebugMode) {
            print('NotificationService: getNotificationTypes Response status code: ${response.statusCode}');
            print('NotificationService: getNotificationTypes Response headers: ${response.headers}');
            print('NotificationService: getNotificationTypes Response body (raw): ${response.body}');
          }
          CookieManager.extractCookies(response);
          return response;
        },
      );
      if (kDebugMode) {
        print('NotificationService: getNotificationTypes Response type: ${response.runtimeType}');
        print('NotificationService: getNotificationTypes Response: $response');
      }
      if (response is Map<String, dynamic>) {
        return List<String>.from(response['types'] ?? []);
      }
      throw Exception('Unexpected response format: Expected Map<String, dynamic>, got ${response.runtimeType}');
    } catch (e, stackTrace) {
      if (kDebugMode) {
        print('NotificationService: Error fetching notification types: $e');
        print('NotificationService: getNotificationTypes Stack trace: $stackTrace');
      }
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> updatePreferences(Map<String, dynamic> preferences) async {
    try {
      if (kDebugMode) print('NotificationService: Starting updatePreferences request at ${DateTime.now().toIso8601String()}');
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/preferences');
          if (kDebugMode) print('NotificationService: Sending PUT request to $url with headers: ${CookieManager.getHeaders({'Content-Type': 'application/json'})} and body: ${jsonEncode({'preferences': preferences})}');
          final response = await http.put(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({'preferences': preferences}),
          );
          if (kDebugMode) {
            print('NotificationService: updatePreferences Response status code: ${response.statusCode}');
            print('NotificationService: updatePreferences Response headers: ${response.headers}');
            print('NotificationService: updatePreferences Response body (raw): ${response.body}');
          }
          CookieManager.extractCookies(response);
          return response;
        },
      );
      if (kDebugMode) {
        print('NotificationService: updatePreferences Response type: ${response.runtimeType}');
        print('NotificationService: updatePreferences Response: $response');
      }
      return response is Map<String, dynamic> ? (response['preferences'] ?? response) : {'preferences': preferences};
    } catch (e, stackTrace) {
      if (kDebugMode) {
        print('NotificationService: Error updating preferences: $e');
        print('NotificationService: updatePreferences Stack trace: $stackTrace');
      }
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> getPreferences() async {
    try {
      if (kDebugMode) print('NotificationService: Starting getPreferences request at ${DateTime.now().toIso8601String()}');
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/preferences');
          if (kDebugMode) print('NotificationService: Sending GET request to $url with headers: ${CookieManager.getHeaders({'Content-Type': 'application/json'})}');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          if (kDebugMode) {
            print('NotificationService: getNotificationTypes Response status code: ${response.statusCode}');
            print('NotificationService: getNotificationTypes Response headers: ${response.headers}');
            print('NotificationService: getNotificationTypes Response body (raw): ${response.body}');
          }
          CookieManager.extractCookies(response);
          return response;
        },
      );
      if (kDebugMode) {
        print('NotificationService: getPreferences Response type: ${response.runtimeType}');
        print('NotificationService: getPreferences Response: $response');
      }
      return response is Map<String, dynamic> ? (response['preferences'] ?? response) : {};
    } catch (e, stackTrace) {
      if (kDebugMode) {
        print('NotificationService: Error fetching preferences: $e');
        print('NotificationService: getPreferences Stack trace: $stackTrace');
      }
      rethrow;
    }
  }

  static Future<List<dynamic>> getNotifications() async {
    try {
      if (kDebugMode) print('NotificationService: Starting getNotifications request at ${DateTime.now().toIso8601String()}');
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications');
          if (kDebugMode) print('NotificationService: Sending GET request to $url with headers: ${CookieManager.getHeaders({'Content-Type': 'application/json'})}');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          if (kDebugMode) {
            print('NotificationService: getNotifications Response status code: ${response.statusCode}');
            print('NotificationService: getNotifications Response headers: ${response.headers}');
            print('NotificationService: getNotifications Response body (raw): ${response.body}');
          }
          CookieManager.extractCookies(response);
          return response;
        },
      );
      if (kDebugMode) {
        print('NotificationService: getNotifications Response type: ${response.runtimeType}');
        print('NotificationService: getNotifications Response: $response');
      }
      return response is List ? response : response['notifications'] ?? [];
    } catch (e, stackTrace) {
      if (kDebugMode) {
        print('NotificationService: Error fetching notifications: $e');
        print('NotificationService: getNotifications Stack trace: $stackTrace');
      }
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> markNotificationAsRead(String notificationID) async {
    try {
      if (kDebugMode) print('NotificationService: Starting markNotificationAsRead request for ID $notificationID at ${DateTime.now().toIso8601String()}');
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/$notificationID/read');
          if (kDebugMode) print('NotificationService: Sending PUT request to $url with headers: ${CookieManager.getHeaders({'Content-Type': 'application/json'})}');
          final response = await http.put(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          if (kDebugMode) {
            print('NotificationService: markNotificationAsRead Response status code: ${response.statusCode}');
            print('NotificationService: markNotificationAsRead Response headers: ${response.headers}');
            print('NotificationService: markNotificationAsRead Response body (raw): ${response.body}');
          }
          CookieManager.extractCookies(response);
          return response;
        },
      );
      if (kDebugMode) {
        print('NotificationService: markNotificationAsRead Response type: ${response.runtimeType}');
        print('NotificationService: markNotificationAsRead Response: $response');
      }
      return response is Map<String, dynamic> ? response : {};
    } catch (e, stackTrace) {
      if (kDebugMode) {
        print('NotificationService: Error marking notification as read: $e');
        print('NotificationService: markNotificationAsRead Stack trace: $stackTrace');
      }
      rethrow;
    }
  }

  static Future<void> markAllNotificationsAsRead() async {
    try {
      if (kDebugMode) print('NotificationService: Starting markAllNotificationsAsRead request at ${DateTime.now().toIso8601String()}');
      await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/notifications/read-all');
          if (kDebugMode) print('NotificationService: Sending PUT request to $url with headers: ${CookieManager.getHeaders({'Content-Type': 'application/json'})}');
          final response = await http.put(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          if (kDebugMode) {
            print('NotificationService: markAllNotificationsAsRead Response status code: ${response.statusCode}');
            print('NotificationService: markAllNotificationsAsRead Response headers: ${response.headers}');
            print('NotificationService: markAllNotificationsAsRead Response body (raw): ${response.body}');
          }
          CookieManager.extractCookies(response);
          return response;
        },
      );
      if (kDebugMode) {
        print('NotificationService: markAllNotificationsAsRead Response successful');
      }
    } catch (e, stackTrace) {
      if (kDebugMode) {
        print('NotificationService: Error marking all notifications as read: $e');
        print('NotificationService: markAllNotificationsAsRead Stack trace: $stackTrace');
      }
      rethrow;
    }
  }
}