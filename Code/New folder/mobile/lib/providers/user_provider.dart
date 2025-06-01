  import 'package:flutter/foundation.dart';
  import 'package:TraceFlow/models/user.dart';
  import 'package:TraceFlow/services/user_service.dart';
  import 'package:TraceFlow/services/auth_service.dart';
  import 'package:TraceFlow/services/cookie_manager.dart';
  import 'package:http/http.dart' as http;

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
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        await CookieManager.loadCookies();
        _currentUser = await UserService.fetchUserProfile();
        if (!_currentUser!.roles.any((role) => role.name?.toLowerCase() == 'supervisor')) {
          throw Exception('Access denied: Supervisor role required');
        }
      } catch (e) {
        _currentUser = null;
        _errorMessage = _parseError(e);
        if (e.toString().contains('401')) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> updateProfile(Map<String, dynamic> data, {http.MultipartFile? pfpFile}) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _currentUser = await UserService.updateProfile(data, pfpFile: pfpFile);
      } catch (e) {
        _errorMessage = _parseError(e);
        if (e.toString().contains('401')) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> fetchUserById(String userID) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _currentUser = await UserService.getUserById(userID);
      } catch (e) {
        _currentUser = null;
        _errorMessage = _parseError(e);
        if (e.toString().contains('401')) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getAllUsers() async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _users = await UserService.getAllUsers();
      } catch (e) {
        _users = [];
        _errorMessage = _parseError(e);
        if (e.toString().contains('401')) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getUsersByRole(String role) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _users = await UserService.getUsersByRole(role);
      } catch (e) {
        _users = [];
        _errorMessage = _parseError(e);
        if (e.toString().contains('401')) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getUserByPhoneNumber(String phone) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _currentUser = await UserService.getUserByPhoneNumber(phone);
      } catch (e) {
        _currentUser = null;
        _errorMessage = _parseError(e);
        if (e.toString().contains('401')) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getManagersByUser(String userID) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _managers = await UserService.getRegionalManagersByUser(userID);
      } catch (e) {
        _managers = [];
        _errorMessage = _parseError(e);
        if (e.toString().contains('401')) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    void clearError() {
      _errorMessage = null;
      notifyListeners();
    }

    String _parseError(dynamic error) {
      if (error is Exception) {
        return error.toString().replaceFirst('Exception: ', '');
      }
      return error.toString();
    }
  }