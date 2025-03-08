import 'package:flutter/cupertino.dart';
import '../models/reason.dart';
import '../models/visit.dart';
import '../services/visits_service.dart';

class VisitProvider with ChangeNotifier {
  final Map<String, bool> _checklistStatus = {};
  List<Reason> _selectedReasons = [];
  DateTime? _startTime;

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
    return _startTime != null ? DateTime.now().difference(_startTime!) : null;
  }

  Future<Visit> fetchVisitByID(String visitID) async {
    try {
      return await VisitService.fetchVisitByID(visitID);
    } catch (e) {
      throw Exception('Failed to fetch visit: $e');
    }
  }

  Future<Visit> logVisit({
    required String visitId,
    required List<Map<String, dynamic>> checklistUpdates, required String visitID, required Map<String, Object> logData,
  }) async {
    try {
      final duration = getElapsedTime()?.inMinutes ?? 0;
      final response = await VisitService.logVisit(visitId, {
        'duration': duration,
        'checklistUpdates': checklistUpdates,
      });
      return response;
    } catch (e) {
      throw Exception('Failed to log visit: $e');
    }
  }

  Future<void> createVisit({
    required String timesheetID,
    required String supervisorID,
    required DateTime date,
    required String time,
    required String agentID,
    required List<dynamic> reasons,
    required List<dynamic> checklists,
  }) async {
    try {
      await VisitService.createVisit({
        'timesheetID': timesheetID,
        'supervisorID': supervisorID,
        'date': date.toIso8601String(),
        'time': time,
        'agentID': agentID,
        'reasons': reasons,
        'checklists': checklists,
      });
      notifyListeners();
    } catch (e) {
      throw Exception('Failed to create visit: $e');
    }
  }
}