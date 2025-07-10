import 'package:flutter/foundation.dart';
import 'package:TraceFlow/models/role.dart';
import 'package:TraceFlow/services/role_service.dart';
import 'package:TraceFlow/services/auth_service.dart';

class RoleProvider with ChangeNotifier {
  final RoleService _roleService;
  List<Role> _roles = [];
  bool _isLoading = false;
  String? _errorMessage;

  RoleProvider({RoleService? roleService}) : _roleService = roleService ?? RoleService();

  List<Role> get roles => _roles;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> getRolesByUser(String userID) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _roles = await _roleService.getRolesByUser(userID);
      if (!_roles.any((role) => role.name?.toLowerCase() == 'supervisor')) {
        throw Exception('Access denied: Supervisor role required');
      }
    } catch (e) {
      _roles = [];
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