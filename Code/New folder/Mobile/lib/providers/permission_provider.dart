import 'package:flutter/foundation.dart';
import 'package:TraceFlow/models/permission.dart';
import 'package:TraceFlow/services/permission_service.dart';
import 'package:TraceFlow/services/auth_service.dart';

class PermissionProvider with ChangeNotifier {
  final PermissionService _permissionService;
  final List<Permission> _permissions = [];
  List<Permission> _effectivePermissions = [];
  bool _isLoading = false;
  String? _errorMessage;

  PermissionProvider({PermissionService? permissionService})
      : _permissionService = permissionService ?? PermissionService();

  List<Permission> get permissions => _permissions;
  List<Permission> get effectivePermissions => _effectivePermissions;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;



  Future<void> getEffectivePermissions(String userID) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _effectivePermissions = await _permissionService.getEffectivePermissions(userID);
    } catch (e) {
      _effectivePermissions = [];
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