// lib/providers/timesheet_provider.dart
import 'package:flutter/foundation.dart';
import '../models/timesheet.dart';
import '../services/timesheet_service.dart';

class TimesheetProvider with ChangeNotifier {
  List<Timesheet> _timesheets = [];
  Timesheet? _currentTimesheet;
  bool _isLoading = false;

  List<Timesheet> get timesheets => _timesheets;
  Timesheet? get currentTimesheet => _currentTimesheet;
  bool get isLoading => _isLoading;

  Future<void> createTimesheet({
    required int weekNumber,
    required int year,
    required String supervisorID,
    required List<Map<String, dynamic>> visits,
    required String token,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final timesheet = await TimesheetService.createTimesheet(
        weekNumber: weekNumber,
        year: year,
        supervisorID: supervisorID,
        visits: visits,
        token: token,
      );
      _timesheets.add(timesheet);
      _currentTimesheet = timesheet;
    } catch (e) {
      throw Exception('Failed to create timesheet: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchTimesheetsBySupervisor(String supervisorID, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _timesheets = await TimesheetService.fetchTimesheetsBySupervisor(supervisorID, token);
    } catch (e) {
      _timesheets = [];
      throw Exception('Failed to fetch timesheets: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchTimesheetById(String id, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentTimesheet = await TimesheetService.fetchTimesheetById(id, token);
    } catch (e) {
      _currentTimesheet = null;
      throw Exception('Failed to fetch timesheet: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void setCurrentTimesheet(Timesheet timesheet) {
    _currentTimesheet = timesheet;
    notifyListeners();
  }
}