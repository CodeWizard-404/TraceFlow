import 'package:flutter/foundation.dart';
import '../models/reason.dart';
import '../services/reason_service.dart';

class ReasonProvider with ChangeNotifier {
  List<Reason> _reasons = [];
  List<Reason> _allReasons = [];
  bool _isLoading = false;

  List<Reason> get reasons => _reasons;
  List<Reason> get allReasons => _allReasons;
  bool get isLoading => _isLoading;

  Future<void> getReasonsByVisitId(String visitId, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _reasons = await ReasonService.getReasonsByVisitId(visitId, token);
    } catch (e) {
      _reasons = [];
      throw Exception('Failed to fetch reasons: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getAllReasons(String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _allReasons = await ReasonService.getAllReasons(token);
    } catch (e) {
      _allReasons = [];
      throw Exception('Failed to fetch all reasons: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
