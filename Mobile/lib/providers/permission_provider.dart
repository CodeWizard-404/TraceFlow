// lib/providers/permission_provider.dart
import 'package:flutter/foundation.dart';
import '../services/permission_service.dart';

class PermissionProvider with ChangeNotifier {
  List<dynamic> _permissions = []; // Use Permission model if defined
  List<dynamic> _effectivePermissions = [];
  bool _isLoading = false;

  List<dynamic> get permissions => _permissions;
  List<dynamic> get effectivePermissions => _effectivePermissions;
  bool get isLoading => _isLoading;

  Future<void> getPermissionsByRole(String roleID, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _permissions = await PermissionService.getPermissionsByRole(roleID, token);
    } catch (e) {
      _permissions = [];
      throw Exception('Failed to fetch permissions by role: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getEffectivePermissions(String userID, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _effectivePermissions = await PermissionService.getEffectivePermissions(userID, token);
    } catch (e) {
      _effectivePermissions = [];
      throw Exception('Failed to fetch effective permissions: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}