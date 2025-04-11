import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/user_service.dart';

class UserProvider with ChangeNotifier {
  List<User> _users = [];
  User? _currentUser;
  List<User> _managers = [];
  bool _isLoading = false;

  List<User> get users => _users;
  User? get currentUser => _currentUser;
  List<User> get managers => _managers;
  bool get isLoading => _isLoading;

  Future<void> fetchUserProfile(String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentUser = await UserService.fetchUserProfile(token);
    } catch (e) {
      _currentUser = null;
      throw Exception('Failed to fetch user profile: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> updateProfile(String token, Map<String, dynamic> data) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentUser = await UserService.updateProfile(token, data);
    } catch (e) {
      throw Exception('Failed to update profile: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchUserById(String userID, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentUser = await UserService.fetchUserById(userID, token);
    } catch (e) {
      _currentUser = null;
      throw Exception('Failed to fetch user: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getAllUsers(String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _users = await UserService.getAllUsers(token);
    } catch (e) {
      _users = [];
      throw Exception('Failed to fetch all users: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getUsersByRole(String role, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _users = await UserService.getUsersByRole(role, token);
    } catch (e) {
      _users = [];
      throw Exception('Failed to fetch users by role $role: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getUserByPhoneNumber(String phone, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentUser = await UserService.getUserByPhoneNumber(phone, token);
    } catch (e) {
      _currentUser = null;
      throw Exception('Failed to fetch user by phone: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getManagersByUser(String userID, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _managers = await UserService.getManagersByUser(userID, token);
    } catch (e) {
      _managers = [];
      throw Exception('Failed to fetch managers: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }


}