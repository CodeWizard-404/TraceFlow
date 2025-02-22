import 'package:flutter/foundation.dart';
import '../models/visit.dart';
import '../services/api_service.dart';

class VisitProvider with ChangeNotifier {
  final List<Visit> _visits = [];
  late DateTime _startTime;

  List<Visit> get visits => _visits;

  // Fetch visits for a specific timesheet
  Future<void> fetchVisits(String timesheetID) async {
    try {
      // TODO: Implement API call to fetch visits for a timesheet
      notifyListeners();
    } catch (error) {
      throw Exception('Failed to fetch visits: $error');
    }
  }

  void startVisitTimer() {
    _startTime = DateTime.now();
  }

  int stopVisitTimer() {
    final endTime = DateTime.now();
    final duration = endTime.difference(_startTime).inMinutes;
    _startTime = DateTime.now();
    return duration;
  }

  // Log visit details
  Future<void> logVisit(String visitId, Map<String, dynamic> logData) async {
    try {
      await ApiService.logVisit(visitId, logData);

      final visitIndex = _visits.indexWhere((v) => v.visitID == visitId);
      if (visitIndex != -1) {
        _visits[visitIndex] = Visit.fromJson(logData);
        notifyListeners();
      }
    } catch (error) {
      throw Exception('Failed to log visit: $error');
    }
  }
}