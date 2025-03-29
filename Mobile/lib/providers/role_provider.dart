// lib/providers/role_provider.dart
import 'package:flutter/foundation.dart';
import '../services/role_service.dart';

class RoleProvider with ChangeNotifier {
  List<dynamic> _roles = []; // Use Role model if defined
  bool _isLoading = false;

  List<dynamic> get roles => _roles;
  bool get isLoading => _isLoading;

  Future<void> getRolesByUser(String userID, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _roles = await RoleService.getRolesByUser(userID, token);
    } catch (e) {
      _roles = [];
      throw Exception('Failed to fetch roles by user: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}