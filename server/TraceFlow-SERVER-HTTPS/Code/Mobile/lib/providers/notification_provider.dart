import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;
import '../models/notification.dart';
import '../services/auth_service.dart';
import '../services/cookie_manager.dart';
import '../services/http_client.dart';
import '../utils/constants.dart';

// Manages real-time notifications using Socket.IO for the TraceFlow mobile app.
class NotificationProvider with ChangeNotifier {
  List<Notification> _notifications = [];
  int _unreadCount = 0;
  socket_io.Socket? _socket;
  bool _isConnected = false;
  Timer? _reconnectTimer;
  String? _userID;
  List<String> _rooms = [];

  // Getters for state
  List<Notification> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get isConnected => _isConnected;

  NotificationProvider() {
    if (kDebugMode) print('NotificationProvider initialized');
  }

  // Initializes Socket.IO connection for authenticated user.
  Future<void> initialize(String userID, List<String> roles) async {
    if (_userID == userID && _isConnected) {
      if (kDebugMode) print('Socket already initialized for userID: $userID');
      return;
    }
    _userID = userID;
    _rooms = [userID, ...roles.map((role) => role.toLowerCase())];
    await _connect();
  }

  // Connects to Socket.IO server.
  Future<void> _connect() async {
    if (_isConnected || _userID == null) return;
    try {
      if (kDebugMode) print('Connecting to Socket.IO, userID: $_userID');
      _socket = socket_io.io(
        baseUrl,
        socket_io.OptionBuilder()
            .setTransports(['websocket'])
            .enableForceNew()
            .setExtraHeaders(CookieManager.getHeaders())
            .build(),
      );

      _socket!.onConnect((_) {
        _isConnected = true;
        _reconnectTimer?.cancel();
        if (kDebugMode) print('Socket.IO connected');
        _joinRooms();
        notifyListeners();
      });

      _socket!.onDisconnect((_) {
        _isConnected = false;
        if (kDebugMode) print('Socket.IO disconnected');
        _startReconnectTimer();
        notifyListeners();
      });

      _socket!.onError((error) {
        if (kDebugMode) print('Socket.IO error: $error');
        _isConnected = false;
        _startReconnectTimer();
        notifyListeners();
      });

      // Handle incoming notifications
      _socket!.on('notification', (data) {
        if (data is Map<String, dynamic>) {
          final notification = Notification.fromJson({
            'notificationID': data['notificationID'] ?? DateTime.now().millisecondsSinceEpoch.toString(),
            'type': data['type'] ?? 'info',
            'message': data['message'] ?? '',
            'title': data['title'],
            'createdAt': data['createdAt'] ?? DateTime.now().toIso8601String(),
            'isRead': false,
            'metadata': data['metadata'],
          });
          _addNotification(notification);
        }
      });

      // Handle token refresh events
      _socket!.on('tokenRefreshed', (_) {
        if (kDebugMode) print('Token refreshed, rejoining rooms');
        _joinRooms();
      });
    } catch (e) {
      if (kDebugMode) print('Socket.IO connection failed: $e');
      _startReconnectTimer();
    }
  }

  // Joins user and role-based rooms.
  void _joinRooms() {
    if (!_isConnected || _socket == null) return;
    for (var room in _rooms) {
      _socket!.emit('joinRoom', room);
      if (kDebugMode) print('Joined room: $room');
    }
  }

  // Adds a notification and updates unread count.
  void _addNotification(Notification notification) {
    if (_notifications.any((n) => n.notificationID == notification.notificationID)) {
      if (kDebugMode) print('Duplicate notification ignored: ${notification.notificationID}');
      return;
    }
    _notifications = [notification, ..._notifications];
    if (!notification.isRead) _unreadCount++;
    if (kDebugMode) print('Added notification: ${notification.message}, unread: $_unreadCount');
    notifyListeners();
  }

  // Marks a notification as read.
  Future<void> markAsRead(String notificationID) async {
    final index = _notifications.indexWhere((n) => n.notificationID == notificationID);
    if (index == -1 || _notifications[index].isRead) return;

    try {
      await AuthService.makeAuthenticatedRequest(
        request: () => CustomHttpClient.post(
          Uri.parse('$baseUrl/notifications/$notificationID/read'),
          headers: {'Content-Type': 'application/json'},
        ),
      );
      _notifications[index] = _notifications[index].copyWith(isRead: true);
      _unreadCount--;
      if (kDebugMode) print('Marked notification as read: $notificationID');
      notifyListeners();
    } catch (e) {
      if (kDebugMode) print('Failed to mark notification as read: $e');
    }
  }

  // Marks all notifications as read.
  Future<void> markAllAsRead() async {
    if (_unreadCount == 0) return;
    try {
      await AuthService.makeAuthenticatedRequest(
        request: () => CustomHttpClient.post(
          Uri.parse('$baseUrl/notifications/read-all'),
          headers: {'Content-Type': 'application/json'},
        ),
      );
      _notifications = _notifications.map((n) => n.copyWith(isRead: true)).toList();
      _unreadCount = 0;
      if (kDebugMode) print('Marked all notifications as read');
      notifyListeners();
    } catch (e) {
      if (kDebugMode) print('Failed to mark all notifications as read: $e');
    }
  }

  // Starts a timer to attempt reconnection.
  void _startReconnectTimer() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer.periodic(const Duration(seconds: 5), (timer) async {
      if (!_isConnected && _userID != null) {
        if (kDebugMode) print('Attempting to reconnect Socket.IO');
        await _connect();
      } else {
        timer.cancel();
      }
    });
  }

  // Cleans up Socket.IO connection and state.
  void cleanup() {
    if (kDebugMode) print('Cleaning up NotificationProvider');
    _socket?.emit('leaveRoom', _rooms);
    _socket?.disconnect();
    _socket = null;
    _isConnected = false;
    _reconnectTimer?.cancel();
    _notifications = [];
    _unreadCount = 0;
    _userID = null;
    _rooms = [];
    notifyListeners();
  }

  @override
  void dispose() {
    cleanup();
    super.dispose();
  }
}