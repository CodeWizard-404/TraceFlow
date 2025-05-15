import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/user_service.dart';
import '../services/auth_service.dart';
import '../services/cookie_manager.dart';

class UserProvider with ChangeNotifier {
  List<User> _users = [];
  User? _currentUser;
  List<User> _managers = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<User> get users => _users;
  User? get currentUser => _currentUser;
  List<User> get managers => _managers;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchUserProfile() async {
    if (kDebugMode) print('UserProvider.fetchUserProfile called');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      _currentUser = await UserService.fetchUserProfile();
      if (kDebugMode) print('Fetched user profile: ${_currentUser?.userID}');
    } catch (e) {
      _currentUser = null;
      _errorMessage = 'Failed to fetch user profile: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> updateProfile(Map<String, dynamic> data) async {
    if (kDebugMode) print('UserProvider.updateProfile called');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _currentUser = await UserService.updateProfile(data);
      if (kDebugMode) print('Updated user profile: ${_currentUser?.userID}');
    } catch (e) {
      _errorMessage = 'Failed to update profile: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchUserById(String userID) async {
    if (kDebugMode) print('UserProvider.fetchUserById called for $userID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _currentUser = await UserService.fetchUserById(userID);
      if (kDebugMode) print('Fetched user by ID: ${_currentUser?.userID}');
    } catch (e) {
      _currentUser = null;
      _errorMessage = 'Failed to fetch user: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getAllUsers() async {
    if (kDebugMode) print('UserProvider.getAllUsers called');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _users = await UserService.getAllUsers();
      if (kDebugMode) print('Fetched ${_users.length} users');
    } catch (e) {
      _users = [];
      _errorMessage = 'Failed to fetch all users: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getUsersByRole(String role) async {
    if (kDebugMode) print('UserProvider.getUsersByRole called for $role');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _users = await UserService.getUsersByRole(role);
      if (kDebugMode) print('Fetched ${_users.length} users for role: $role');
    } catch (e) {
      _users = [];
      _errorMessage = 'Failed to fetch users by role $role: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getUserByPhoneNumber(String phone) async {
    if (kDebugMode) print('UserProvider.getUserByPhoneNumber called for $phone');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _currentUser = await UserService.getUserByPhoneNumber(phone);
      if (kDebugMode) print('Fetched user by phone: ${_currentUser?.userID}');
    } catch (e) {
      _currentUser = null;
      _errorMessage = 'Failed to fetch user by phone: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getManagersByUser(String userID) async {
    if (kDebugMode) print('UserProvider.getManagersByUser called for $userID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _managers = await UserService.getManagersByUser(userID);
      if (kDebugMode) print('Fetched ${_managers.length} managers for user: $userID');
    } catch (e) {
      _managers = [];
      _errorMessage = 'Failed to fetch managers: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}