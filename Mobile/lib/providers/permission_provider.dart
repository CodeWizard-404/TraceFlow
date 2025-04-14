import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../services/permission_service.dart';

class PermissionProvider with ChangeNotifier {
  final PermissionService _permissionService;
  List<dynamic> _permissions = []; // Use Permission model if defined
  List<dynamic> _effectivePermissions = [];
  bool _isLoading = false;
  String? _errorMessage;

  PermissionProvider({PermissionService? permissionService})
      : _permissionService = permissionService ?? PermissionService();

  List<dynamic> get permissions => _permissions;
  List<dynamic> get effectivePermissions => _effectivePermissions;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> getPermissionsByRole(String roleID) async {
    if (kDebugMode) print('Fetching permissions for role ID: $roleID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _permissions = await _permissionService.getPermissionsByRole(roleID);
      if (kDebugMode) print('Fetched ${_permissions.length} permissions for role: $roleID');
    } catch (e) {
      _permissions = [];
      _errorMessage = 'Failed to fetch permissions: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getEffectivePermissions(String userID) async {
    if (kDebugMode) print('Fetching effective permissions for user ID: $userID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _effectivePermissions = await _permissionService.getEffectivePermissions(userID);
      if (kDebugMode) print('Fetched ${_effectivePermissions.length} effective permissions for user: $userID');
    } catch (e) {
      _effectivePermissions = [];
      _errorMessage = 'Failed to fetch effective permissions: $e';
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