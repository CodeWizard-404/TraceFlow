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
    } catch (e) {
      _currentUser = null;
      _errorMessage = _parseError(e);
      if (kDebugMode) print('Error in fetchUserProfile: $_errorMessage');
      if (_errorMessage?.contains('401') ?? false) {
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
      if (kDebugMode) print('Error in updateProfile: $_errorMessage');
      if (_errorMessage?.contains('401') ?? false) {
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
      if (kDebugMode) print('Error in fetchUserById: $_errorMessage');
      if (_errorMessage?.contains('401') ?? false) {
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
      if (kDebugMode) print('Error in getAllUsers: $_errorMessage');
      if (_errorMessage?.contains('401') ?? false) {
        await AuthService.logout();
      }
    }
  }

    Future<void> getUsersByRole(String role) async {
      if (kDebugMode) print('Fetching users for role: $role');
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _users = await UserService.getUsersByRole(role);
        if (kDebugMode) print('Fetched ${_users.length} users for role $role');
      } catch (e) {
        _users = [];
        _errorMessage = _parseError(e);
        if (kDebugMode) print('Error in getUsersByRole ($role): $_errorMessage');
        if (_errorMessage?.contains('401') ?? false) {
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
        if (kDebugMode) print('Error in getUserByPhoneNumber: $_errorMessage');
        if (_errorMessage?.contains('401') ?? false) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getUsersByRegion(String regionID) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _users = await UserService.getUsersByRegion(regionID);
      } catch (e) {
        _users = [];
        _errorMessage = _parseError(e);
        if (kDebugMode) print('Error in getUsersByRegion: $_errorMessage');
        if (_errorMessage?.contains('401') ?? false) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getUsersByGovernorate(String governorateID) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _users = await UserService.getUsersByGovernorate(governorateID);
      } catch (e) {
        _users = [];
        _errorMessage = _parseError(e);
        if (kDebugMode) print('Error in getUsersByGovernorate: $_errorMessage');
        if (_errorMessage?.contains('401') ?? false) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getUsersByDelegation(String delegationID) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _users = await UserService.getUsersByDelegation(delegationID);
      } catch (e) {
        _users = [];
        _errorMessage = _parseError(e);
        if (kDebugMode) print('Error in getUsersByDelegation: $_errorMessage');
        if (_errorMessage?.contains('401') ?? false) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getSupervisorsByRegionalManager(String regionalManagerID) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _managers = await UserService.getSupervisorsByRegionalManager(regionalManagerID);
      } catch (e) {
        _managers = [];
        _errorMessage = _parseError(e);
        if (kDebugMode) print('Error in getSupervisorsByRegionalManager: $_errorMessage');
        if (_errorMessage?.contains('401') ?? false) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getRegionalManagersByDirector(String directorID) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _managers = await UserService.getRegionalManagersByDirector(directorID);
      } catch (e) {
        _managers = [];
        _errorMessage = _parseError(e);
        if (kDebugMode) print('Error in getRegionalManagersByDirector: $_errorMessage');
        if (_errorMessage?.contains('401') ?? false) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getDirectorByRegionalManager(String regionalManagerID) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _currentUser = await UserService.getDirectorByRegionalManager(regionalManagerID);
      } catch (e) {
        _currentUser = null;
        _errorMessage = _parseError(e);
        if (kDebugMode) print('Error in getDirectorByRegionalManager: $_errorMessage');
        if (_errorMessage?.contains('401') ?? false) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

  Future<User> getRegionalManagerBySupervisor(String supervisorID) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final manager = await UserService.getRegionalManagerBySupervisor(supervisorID);
      _currentUser = manager;
      return manager;
    } catch (e) {
      _currentUser = null;
      _errorMessage = _parseError(e);
      if (kDebugMode) print('Error in getRegionalManagerBySupervisor: $_errorMessage');
      if (_errorMessage?.contains('401') ?? false) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

    Future<void> getSupervisorsByUser(String userID) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _managers = await UserService.getSupervisorsByUser(userID);
      } catch (e) {
        _managers = [];
        _errorMessage = _parseError(e);
        if (kDebugMode) print('Error in getSupervisorsByUser: $_errorMessage');
        if (_errorMessage?.contains('401') ?? false) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getRegionalManagersByUser(String userID) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _managers = await UserService.getRegionalManagersByUser(userID);
      } catch (e) {
        _managers = [];
        _errorMessage = _parseError(e);
        if (kDebugMode) print('Error in getRegionalManagersByUser: $_errorMessage');
        if (_errorMessage?.contains('401') ?? false) {
          await AuthService.logout();
        }
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }

    Future<void> getDirectorByUser(String userID) async {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      try {
        _currentUser = await UserService.getDirectorByUser(userID);
      } catch (e) {
        _currentUser = null;
        _errorMessage = _parseError(e);
        if (kDebugMode) print('Error in getDirectorByUser: $_errorMessage');
        if (_errorMessage?.contains('401') ?? false) {
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
