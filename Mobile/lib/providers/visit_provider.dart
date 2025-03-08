import 'dart:convert';

import 'package:flutter/foundation.dart';
import '../models/reason.dart';
import '../models/visit.dart';
import '../services/visits_service.dart';

class VisitProvider with ChangeNotifier {
  Map<String, bool> _checklistStatus = {};
  List<Reason> _selectedReasons = [];
  final List<Visit> _visits = [];
  late DateTime _startTime;

  List<Visit> get visits => _visits;

  Map<String, bool> get checklistStatus => _checklistStatus;
  List<Reason> get selectedReasons => _selectedReasons;

  void updateChecklistStatus(String checklistId, bool value) {
    _checklistStatus[checklistId] = value;
    notifyListeners();
  }

  void setSelectedReasons(List<Reason> reasons) {
    _selectedReasons = reasons;
    notifyListeners();
  }

  void startVisitTimer() {
    _startTime = DateTime.now();
    notifyListeners();
  }

  Duration? getElapsedTime() {
    if (_startTime == null) return null;
    return DateTime.now().difference(_startTime!);
  }

  // Fetch a visit by its ID from the backend
  Future<Visit> fetchVisitByID(String visitID) async {
    try {
      final visitData = await VisitService.fetchVisitByID(visitID);
      return Visit.fromJson(visitData as Map<String, dynamic>);
    } catch (error) {
      throw Exception('Failed to fetch visit: $error');
    }
  }

  // Log visit details
  Future<Visit> logVisit({
    required String visitID, required Map<String, Object> logData,

  }) async {

    try {

      final duration = getElapsedTime()?.inMinutes.toString() ?? '0';

      // Service now returns Visit directly
      final visit = await VisitService.logVisit(visitID, {
        'duration': duration,
        'checklistUpdates': _checklistStatus,
      });

      return visit;
    } catch (error) {
      throw Exception('Failed to log visit: $error');
    }
  }



}