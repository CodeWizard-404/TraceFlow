import 'package:flutter/foundation.dart';
import '../models/timesheet.dart';
import '../services/timesheet_service.dart';

class TimesheetProvider with ChangeNotifier {
  List<Timesheet> _timesheets = [];
  Timesheet? _currentTimesheet;
  bool _isLoading = false;
  String? _errorMessage;

  List<Timesheet> get timesheets => _timesheets;
  Timesheet? get currentTimesheet => _currentTimesheet;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> createTimesheet({
    required int weekNumber,
    required int year,
    required String supervisorID,
    required List<Map<String, dynamic>> visits,
  }) async {
    if (kDebugMode) print('TimesheetProvider.createTimesheet called');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final timesheet = await TimesheetService.createTimesheet(
        weekNumber: weekNumber,
        year: year,
        supervisorID: supervisorID,
        visits: visits,
      );
      _timesheets.add(timesheet);
      _currentTimesheet = timesheet;
      if (kDebugMode) print('Created timesheet: ${timesheet.timesheetID}');
    } catch (e) {
      _errorMessage = 'Failed to create timesheet: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchTimesheetsBySupervisor(String supervisorID) async {
    if (kDebugMode) print('TimesheetProvider.fetchTimesheetsBySupervisor called for $supervisorID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _timesheets = await TimesheetService.fetchTimesheetsBySupervisor(supervisorID);
      if (kDebugMode) print('Fetched ${_timesheets.length} timesheets');
    } catch (e) {
      _timesheets = [];
      _errorMessage = 'Failed to fetch timesheets: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchTimesheetById(String id) async {
    if (kDebugMode) print('TimesheetProvider.fetchTimesheetById called for $id');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _currentTimesheet = await TimesheetService.fetchTimesheetById(id);
      if (kDebugMode) print('Fetched timesheet: $id');
    } catch (e) {
      _currentTimesheet = null;
      _errorMessage = 'Failed to fetch timesheet: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void setCurrentTimesheet(Timesheet timesheet) {
    _currentTimesheet = timesheet;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}