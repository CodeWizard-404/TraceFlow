import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../services/role_service.dart';

class RoleProvider with ChangeNotifier {
  final RoleService _roleService;
  List<dynamic> _roles = []; // Use Role model if defined
  bool _isLoading = false;
  String? _errorMessage;

  RoleProvider({RoleService? roleService})
      : _roleService = roleService ?? RoleService();

  List<dynamic> get roles => _roles;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> getRolesByUser(String userID) async {
    if (kDebugMode) print('Fetching roles for user ID: $userID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _roles = await _roleService.getRolesByUser(userID);
      if (kDebugMode) print('Fetched ${_roles.length} roles for user: $userID');
    } catch (e) {
      _roles = [];
      _errorMessage = 'Failed to fetch roles: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    if (kDebugMode) print('Clearing error message');
    _errorMessage = null;
    notifyListeners();
  }
}