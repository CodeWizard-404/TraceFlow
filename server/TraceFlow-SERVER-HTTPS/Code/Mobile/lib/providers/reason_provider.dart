import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../models/reason.dart';
import '../services/reason_service.dart';

class ReasonProvider with ChangeNotifier {
  final ReasonService _reasonService;
  List<Reason> _reasons = [];
  List<Reason> _allReasons = [];
  bool _isLoading = false;
  String? _errorMessage;

  ReasonProvider({ReasonService? reasonService})
      : _reasonService = reasonService ?? ReasonService();

  List<Reason> get reasons => _reasons;
  List<Reason> get allReasons => _allReasons;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> getReasonsByVisitId(String visitId) async {
    if (kDebugMode) print('Fetching reasons for visit ID: $visitId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _reasons = await _reasonService.getReasonsByVisitId(visitId);
      if (kDebugMode) print('Fetched ${_reasons.length} reasons for visit: $visitId');
    } catch (e) {
      _reasons = [];
      _errorMessage = 'Failed to fetch reasons: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getAllReasons() async {
    if (_allReasons.isNotEmpty) {
      if (kDebugMode) print('All reasons already loaded, skipping fetch');
      return;
    }
    if (kDebugMode) print('Fetching all reasons');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _allReasons = await _reasonService.getAllReasons();
      if (kDebugMode) print('Fetched ${_allReasons.length} reasons');
    } catch (e) {
      _allReasons = [];
      _errorMessage = 'Failed to fetch all reasons: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void setReasons(List<Reason> reasons) {
    if (kDebugMode) print('Setting reasons: ${reasons.length}');
    _reasons = reasons;
    notifyListeners();
  }

  void clearError() {
    if (kDebugMode) print('Clearing error message');
    _errorMessage = null;
    notifyListeners();
  }
}