import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../models/notification.dart';
import '../models/notification_rule.dart';
import '../services/cookie_manager.dart';
import '../services/notification_service.dart';
import '../utils/constants.dart';
import '../providers/auth_provider.dart'; // Assume this exists

class NotificationProvider with ChangeNotifier {
  IO.Socket? _socket;
  List<Notification> _notifications = [];
  Map<String, Map<String, bool>> _preferences = {};
  List<String> _notificationTypes = [];
  List<NotificationRule> _rules = [];
  bool _isLoading = false;
  String? _errorMessage;
  String? _userID;
  List<String> _roles = [];

  // Getters
  List<Notification> get notifications => _notifications;
  Map<String, Map<String, bool>> get preferences => _preferences;
  List<String> get notificationTypes => _notificationTypes;
  List<NotificationRule> get rules => _rules;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Initializes the provider with WebSocket connection and fetches initial data
  void initialize(String userID, List<String> roles) {
    if (kDebugMode) print('NotificationProvider: Starting initialize for userID: $userID at ${DateTime.now().toIso8601String()}');
    _userID = userID;
    _roles = roles.map((r) => r.toLowerCase()).toList();
    _connectToSocket(userID, roles);
    _fetchRules();
    fetchPreferences();
    _fetchNotificationTypes();
    fetchNotifications();
    if (kDebugMode) print('NotificationProvider: Completed initialize at ${DateTime.now().toIso8601String()}');
  }

  /// Establishes WebSocket connection and sets up event listeners
  void _connectToSocket(String userID, List<String> roles) {
    _socket = IO.io(baseUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'extraHeaders': {
        'Cookie': 'accessToken=${CookieManager.cookies['accessToken']}',
      },
    });

    _socket!.connect();

    _socket!.onConnect((_) {
      if (kDebugMode) print('NotificationProvider: Connected to WebSocket at ${DateTime.now().toIso8601String()}');
      _socket!.emit('join', userID);
      for (var role in roles) {
        _socket!.emit('join', role.toLowerCase());
      }
    });

    _socket!.on('notification', (data) {
      if (kDebugMode) print('NotificationProvider: Received notification: $data');
      final notification = Notification.fromJson(data is String ? jsonDecode(data) : data);
      _notifications.insert(0, notification);
      notifyListeners();
    });

    _socket!.on('notification:updated', (data) {
      if (kDebugMode) print('NotificationProvider: Notification updated: $data');
      final notificationID = data['notificationID'];
      final status = data['status'];
      final index = _notifications.indexWhere((n) => n.notificationID == notificationID);
      if (index != -1) {
        _notifications[index] = Notification(
          notificationID: _notifications[index].notificationID,
          type: _notifications[index].type,
          message: _notifications[index].message,
          channel: _notifications[index].channel,
          status: status,
          createdAt: _notifications[index].createdAt,
          userID: _notifications[index].userID,
          updatedAt: null,
        );
        notifyListeners();
      }
    });

    _socket!.onDisconnect((_) {
      if (kDebugMode) print('NotificationProvider: Disconnected from WebSocket at ${DateTime.now().toIso8601String()}');
    });

    _socket!.onConnectError((error) {
      if (kDebugMode) print('NotificationProvider: WebSocket connection error: $error');
      _errorMessage = 'WebSocket connection failed: $error';
      notifyListeners();
    });
  }

  /// Fetches and filters notification rules for the current user
  Future<void> _fetchRules() async {
    _isLoading = true;
    if (kDebugMode) print('NotificationProvider: Starting _fetchRules at ${DateTime.now().toIso8601String()}');
    notifyListeners();
    try {
      final rulesData = await NotificationService.getRules();
      if (kDebugMode) {
        print('NotificationProvider: Received rulesData: $rulesData');
        print('NotificationProvider: rulesData type: ${rulesData.runtimeType}');
        print('NotificationProvider: rulesData length: ${rulesData.length}');
      }
      // Parse rules into NotificationRule objects
      final allRules = rulesData.map((data) => NotificationRule.fromJson(data)).toList();
      // Filter rules by userID or roles
      final userRules = allRules.where((rule) {
        final recipients = rule.recipients;
        final byUserID = (recipients['userIDs'] as List<dynamic>?)?.contains(_userID) ?? false;
        final byRole = (recipients['roles'] as List<dynamic>?)?.any((role) => _roles.contains(role.toString().toLowerCase())) ?? false;
        return byUserID || byRole;
      }).toList();
      _rules = userRules;
      if (kDebugMode) {
        print('NotificationProvider: Filtered userRules length: ${userRules.length}');
        print('NotificationProvider: Filtered rules: ${userRules.map((r) => {'event': r.event, 'type': r.type, 'priority': r.priority}).toList()}');
      }
      // Initialize default preferences from rules
      _preferences = {
        for (var rule in userRules)
          rule.event: {
            'email': rule.channels['email'] as bool? ?? false,
            'sms': rule.channels['sms'] as bool? ?? false,
            'inApp': rule.channels['inApp'] as bool? ?? false,
          }
      };
      if (kDebugMode) print('NotificationProvider: Initialized preferences from rules: $_preferences');
    } catch (e, stackTrace) {
      _errorMessage = 'Failed to fetch rules: $e';
      if (kDebugMode) {
        print('NotificationProvider: Error in _fetchRules: $e');
        print('NotificationProvider: _fetchRules Stack trace: $stackTrace');
      }
    } finally {
      _isLoading = false;
      notifyListeners();
      if (kDebugMode) print('NotificationProvider: _fetchRules completed, isLoading: $_isLoading, errorMessage: $_errorMessage');
    }
  }

  /// Fetches notification preferences and merges with rule-based defaults
  Future<void> fetchPreferences() async {
    _isLoading = true;
    if (kDebugMode) print('NotificationProvider: Starting fetchPreferences at ${DateTime.now().toIso8601String()}');
    notifyListeners();
    try {
      final preferencesData = await NotificationService.getPreferences();
      if (kDebugMode) {
        print('NotificationProvider: Received preferencesData: $preferencesData');
        print('NotificationProvider: preferencesData type: ${preferencesData.runtimeType}');
        print('NotificationProvider: preferencesData keys: ${preferencesData.keys}');
      }
      if (preferencesData is! Map<String, dynamic>) {
        if (kDebugMode) print('NotificationProvider: Invalid preferences data: Expected Map<String, dynamic>, got ${preferencesData.runtimeType}');
        throw Exception('Invalid preferences data: Expected Map<String, dynamic>, got ${preferencesData.runtimeType}');
      }
      // Merge API preferences with rule-based defaults
      final newPreferences = Map<String, Map<String, bool>>.from(_preferences);
      preferencesData.forEach((event, channels) {
        if (channels is Map<String, dynamic>) {
          newPreferences[event] = {
            'email': channels['email'] as bool? ?? _preferences[event]?['email'] ?? false,
            'sms': channels['sms'] as bool? ?? _preferences[event]?['sms'] ?? false,
            'inApp': channels['inApp'] as bool? ?? _preferences[event]?['inApp'] ?? false,
          };
        }
      });
      _preferences = newPreferences;
      if (kDebugMode) print('NotificationProvider: Successfully merged preferences: $_preferences');
    } catch (e, stackTrace) {
      _errorMessage = 'Failed to fetch preferences: $e';
      if (kDebugMode) {
        print('NotificationProvider: Error in fetchPreferences: $e');
        print('NotificationProvider: fetchPreferences Stack trace: $stackTrace');
      }
    } finally {
      _isLoading = false;
      notifyListeners();
      if (kDebugMode) print('NotificationProvider: fetchPreferences completed, isLoading: $_isLoading, errorMessage: $_errorMessage');
    }
  }

  /// Fetches available notification types
  Future<void> _fetchNotificationTypes() async {
    _isLoading = true;
    if (kDebugMode) print('NotificationProvider: Starting _fetchNotificationTypes at ${DateTime.now().toIso8601String()}');
    notifyListeners();
    try {
      final typesData = await NotificationService.getNotificationTypes();
      if (kDebugMode) {
        print('NotificationProvider: Received typesData: $typesData');
        print('NotificationProvider: typesData type: ${typesData.runtimeType}');
        print('NotificationProvider: typesData length: ${typesData.length}');
      }
      _notificationTypes = typesData;
      if (kDebugMode) print('NotificationProvider: Successfully stored ${typesData.length} notification types');
    } catch (e, stackTrace) {
      _errorMessage = 'Failed to fetch notification types: $e';
      if (kDebugMode) {
        print('NotificationProvider: Error in _fetchNotificationTypes: $e');
        print('NotificationProvider: _fetchNotificationTypes Stack trace: $stackTrace');
      }
    } finally {
      _isLoading = false;
      notifyListeners();
      if (kDebugMode) print('NotificationProvider: _fetchNotificationTypes completed, isLoading: $_isLoading, errorMessage: $_errorMessage');
    }
  }

  /// Fetches user's notifications
  Future<void> fetchNotifications() async {
    _isLoading = true;
    if (kDebugMode) print('NotificationProvider: Starting fetchNotifications at ${DateTime.now().toIso8601String()}');
    notifyListeners();
    try {
      final notificationsData = await NotificationService.getNotifications();
      if (kDebugMode) {
        print('NotificationProvider: Received notificationsData: $notificationsData');
        print('NotificationProvider: notificationsData type: ${notificationsData.runtimeType}');
        print('NotificationProvider: notificationsData length: ${notificationsData.length}');
      }
      _notifications = notificationsData
          .asMap()
          .entries
          .map((entry) {
        final index = entry.key;
        final data = entry.value;
        if (kDebugMode) print('NotificationProvider: Processing notification #$index: $data');
        if (data is! Map<String, dynamic>) {
          if (kDebugMode) print('NotificationProvider: Invalid notification data at index $index: Expected Map<String, dynamic>, got ${data.runtimeType}');
          throw Exception('Invalid notification data at index $index: Expected Map<String, dynamic>, got ${data.runtimeType}');
        }
        try {
          return Notification.fromJson(data);
        } catch (e, stackTrace) {
          if (kDebugMode) {
            print('NotificationProvider: Error parsing notification at index $index: $e');
            print('NotificationProvider: Notification data: $data');
            print('NotificationProvider: Stack trace: $stackTrace');
          }
          rethrow;
        }
      })
          .toList();
      if (kDebugMode) print('NotificationProvider: Successfully parsed ${_notifications.length} notifications');
    } catch (e, stackTrace) {
      _errorMessage = 'Failed to fetch notifications: $e';
      if (kDebugMode) {
        print('NotificationProvider: Error in fetchNotifications: $e');
        print('NotificationProvider: Stack trace: $stackTrace');
      }
    } finally {
      _isLoading = false;
      notifyListeners();
      if (kDebugMode) print('NotificationProvider: fetchNotifications completed, isLoading: $_isLoading, errorMessage: $_errorMessage');
    }
  }

  /// Updates notification preferences
  Future<void> updatePreferences(Map<String, Map<String, bool>> preferences) async {
    _isLoading = true;
    if (kDebugMode) print('NotificationProvider: Starting updatePreferences at ${DateTime.now().toIso8601String()}');
    notifyListeners();
    try {
      // Filter out high-priority rules
      final editablePrefs = Map<String, Map<String, bool>>.from(preferences);
      for (var rule in _rules) {
        if (rule.priority == 'high' && preferences.containsKey(rule.event)) {
          editablePrefs[rule.event] = {
            'email': rule.channels['email'] as bool,
            'sms': rule.channels['sms'] as bool,
            'inApp': rule.channels['inApp'] as bool,
          };
        }
      }
      final preferencesData = await NotificationService.updatePreferences(editablePrefs);
      if (kDebugMode) {
        print('NotificationProvider: Received updatePreferences response: $preferencesData');
        print('NotificationProvider: updatePreferences response type: ${preferencesData.runtimeType}');
        print('NotificationProvider: updatePreferences response keys: ${preferencesData.keys}');
      }
      _preferences = Map<String, Map<String, bool>>.from(preferencesData['preferences'] ?? editablePrefs);
      if (kDebugMode) print('NotificationProvider: Successfully updated preferences: $_preferences');
    } catch (e, stackTrace) {
      _errorMessage = 'Failed to update preferences: $e';
      if (kDebugMode) {
        print('NotificationProvider: Error in updatePreferences: $e');
        print('NotificationProvider: updatePreferences Stack trace: $stackTrace');
      }
    } finally {
      _isLoading = false;
      notifyListeners();
      if (kDebugMode) print('NotificationProvider: updatePreferences completed, isLoading: $_isLoading, errorMessage: $_errorMessage');
    }
  }

  /// Marks a single notification as read
  Future<void> markNotificationAsRead(String notificationID) async {
    _isLoading = true;
    if (kDebugMode) print('NotificationProvider: Starting markNotificationAsRead for ID $notificationID at ${DateTime.now().toIso8601String()}');
    notifyListeners();
    try {
      final responseData = await NotificationService.markNotificationAsRead(notificationID);
      if (kDebugMode) {
        print('NotificationProvider: Received markNotificationAsRead response: $responseData');
        print('NotificationProvider: markNotificationAsRead response type: ${responseData.runtimeType}');
        print('NotificationProvider: markNotificationAsRead response keys: ${responseData.keys}');
      }
      final index = _notifications.indexWhere((n) => n.notificationID == notificationID);
      if (index != -1) {
        _notifications[index] = Notification(
          notificationID: _notifications[index].notificationID,
          type: _notifications[index].type,
          message: _notifications[index].message,
          channel: _notifications[index].channel,
          status: responseData['status'] ?? 'read',
          createdAt: _notifications[index].createdAt,
          userID: _notifications[index].userID,
          updatedAt: responseData['updatedAt'] != null ? DateTime.parse(responseData['updatedAt']) : null,
        );
        if (kDebugMode) print('NotificationProvider: Updated notification at index $index to status: ${responseData['status'] ?? 'read'}');
      }
    } catch (e, stackTrace) {
      _errorMessage = 'Failed to mark notification as read: $e';
      if (kDebugMode) {
        print('NotificationProvider: Error in markNotificationAsRead: $e');
        print('NotificationProvider: markNotificationAsRead Stack trace: $stackTrace');
      }
    } finally {
      _isLoading = false;
      notifyListeners();
      if (kDebugMode) print('NotificationProvider: markNotificationAsRead completed, isLoading: $_isLoading, errorMessage: $_errorMessage');
    }
  }

  /// Marks all notifications as read
  Future<void> markAllNotificationsAsRead() async {
    _isLoading = true;
    if (kDebugMode) print('NotificationProvider: Starting markAllNotificationsAsRead at ${DateTime.now().toIso8601String()}');
    notifyListeners();
    try {
      await NotificationService.markAllNotificationsAsRead();
      _notifications = _notifications
          .map((n) => Notification(
        notificationID: n.notificationID,
        type: n.type,
        message: n.message,
        channel: n.channel,
        status: 'read',
        createdAt: n.createdAt,
        userID: n.userID,
        updatedAt: DateTime.now(),
      ))
          .toList();
      if (kDebugMode) print('NotificationProvider: Successfully marked all ${_notifications.length} notifications as read');
    } catch (e, stackTrace) {
      _errorMessage = 'Failed to mark all notifications as read: $e';
      if (kDebugMode) {
        print('NotificationProvider: Error in markAllNotificationsAsRead: $e');
        print('NotificationProvider: markAllNotificationsAsRead Stack trace: $stackTrace');
      }
    } finally {
      _isLoading = false;
      notifyListeners();
      if (kDebugMode) print('NotificationProvider: markAllNotificationsAsRead completed, isLoading: $_isLoading, errorMessage: $_errorMessage');
    }
  }

  /// Clears error message
  void clearError() {
    _errorMessage = null;
    if (kDebugMode) print('NotificationProvider: Cleared error message at ${DateTime.now().toIso8601String()}');
    notifyListeners();
  }

  @override
  void dispose() {
    if (kDebugMode) print('NotificationProvider: Disposing provider at ${DateTime.now().toIso8601String()}');
    _socket?.disconnect();
    super.dispose();
  }
}