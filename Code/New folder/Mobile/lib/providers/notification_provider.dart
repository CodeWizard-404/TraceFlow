import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../models/notification.dart';
import '../services/cookie_manager.dart';
import '../services/notification_service.dart';
import '../utils/constants.dart';

class NotificationProvider with ChangeNotifier {
  IO.Socket? _socket;
  List<Notification> _notifications = [];
  Map<String, dynamic> _preferences = {};
  List<String> _notificationTypes = [];
  List<dynamic> _rules = [];
  bool _isLoading = false;
  String? _errorMessage;

  // Getters
  List<Notification> get notifications => _notifications;
  Map<String, dynamic> get preferences => _preferences;
  List<String> get notificationTypes => _notificationTypes;
  List<dynamic> get rules => _rules;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Initializes the provider with WebSocket connection and fetches initial data
  void initialize(String userID, List<String> roles) {
    _connectToSocket(userID, roles);
    _fetchRules();
    _fetchPreferences();
    _fetchNotificationTypes();
    _fetchNotifications();
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
      if (kDebugMode) print('Connected to WebSocket');
      _socket!.emit('join', userID);
      for (var role in roles) {
        _socket!.emit('join', role.toLowerCase());
      }
    });

    _socket!.on('notification', (data) {
      if (kDebugMode) print('Received notification: $data');
      final notification = Notification.fromJson(data is String ? jsonDecode(data) : data);
      _notifications.insert(0, notification);
      notifyListeners();
    });

    _socket!.on('notification:updated', (data) {
      if (kDebugMode) print('Notification updated: $data');
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
          userID: _notifications[index].userID, updatedAt: null,
        );
        notifyListeners();
      }
    });

    _socket!.onDisconnect((_) {
      if (kDebugMode) print('Disconnected from WebSocket');
    });

    _socket!.onConnectError((error) {
      if (kDebugMode) print('WebSocket connection error: $error');
      _errorMessage = 'WebSocket connection failed';
      notifyListeners();
    });
  }

  /// Fetches notification rules
  Future<void> _fetchRules() async {
    _isLoading = true;
    notifyListeners();
    try {
      _rules = await NotificationService.getRules();
    } catch (e) {
      _errorMessage = 'Failed to fetch rules: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches notification preferences
  Future<void> _fetchPreferences() async {
    _isLoading = true;
    notifyListeners();
    try {
      final result = await NotificationService.getPreferences();
      _preferences = result['preferences'] ?? {};
    } catch (e) {
      _errorMessage = 'Failed to fetch preferences: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches available notification types
  Future<void> _fetchNotificationTypes() async {
    _isLoading = true;
    notifyListeners();
    try {
      _notificationTypes = await NotificationService.getNotificationTypes();
    } catch (e) {
      _errorMessage = 'Failed to fetch notification types: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches user's notifications
  Future<void> _fetchNotifications() async {
    _isLoading = true;
    notifyListeners();
    try {
      final notificationsData = await NotificationService.getNotifications();
      _notifications = notificationsData.map((data) => Notification.fromJson(data)).toList();
    } catch (e) {
      _errorMessage = 'Failed to fetch notifications: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Updates notification preferences
  Future<void> updatePreferences(Map<String, dynamic> preferences) async {
    _isLoading = true;
    notifyListeners();
    try {
      await NotificationService.updatePreferences(preferences);
      _preferences = preferences;
    } catch (e) {
      _errorMessage = 'Failed to update preferences: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Marks a single notification as read
  Future<void> markNotificationAsRead(String notificationID) async {
    try {
      await NotificationService.markNotificationAsRead(notificationID);
      final index = _notifications.indexWhere((n) => n.notificationID == notificationID);
      if (index != -1) {
        _notifications[index] = Notification(
          notificationID: _notifications[index].notificationID,
          type: _notifications[index].type,
          message: _notifications[index].message,
          channel: _notifications[index].channel,
          status: 'read',
          createdAt: _notifications[index].createdAt,
          userID: _notifications[index].userID, updatedAt: null,
        );
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = 'Failed to mark notification as read: $e';
    }
  }

  /// Marks all notifications as read
  Future<void> markAllNotificationsAsRead() async {
    try {
      await NotificationService.markAllNotificationsAsRead();
      _notifications = _notifications.map((n) => Notification(
        notificationID: n.notificationID,
        type: n.type,
        message: n.message,
        channel: n.channel,
        status: 'read',
        createdAt: n.createdAt,
        userID: n.userID, updatedAt: null,
      )).toList();
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to mark all notifications as read: $e';
    }
  }

  /// Clears error message
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _socket?.disconnect();
    super.dispose();
  }
}