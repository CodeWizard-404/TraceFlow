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



  Future<void> createTimesheetForSupervisor({
    required int weekNumber,
    required int year,
    required String supervisorID,
    required List<Map<String, dynamic>> visits,
    String status = 'pending',
  }) async {
    if (kDebugMode) print('TimesheetProvider.createTimesheetForSupervisor called');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final timesheet = await TimesheetService.createTimesheetForSupervisor(
        weekNumber: weekNumber,
        year: year,
        supervisorID: supervisorID,
        visits: visits,
        status: status,
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

  Future<void> fetchTimesheetByWeekAndYear({
    required int weekNumber,
    required int year,
    required String supervisorID,
  }) async {
    if (kDebugMode) print('TimesheetProvider.fetchTimesheetByWeekAndYear called for week $weekNumber, year $year');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _currentTimesheet = await TimesheetService.fetchTimesheetByWeekAndYear(
        weekNumber: weekNumber,
        year: year,
        supervisorID: supervisorID,
      );
      if (kDebugMode) print('Fetched timesheet for week $weekNumber, year $year');
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

  Future<Map<String, dynamic>> suggestTimesheet({
    required String supervisorID,
    required int weekNumber,
    required int year,
    required Map<String, dynamic> coordinates,
    Map<String, dynamic>? criteria,
  }) async {
    if (kDebugMode) print('TimesheetProvider.suggestTimesheet called for supervisor $supervisorID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await TimesheetService.suggestTimesheet(
        supervisorID: supervisorID,
        weekNumber: weekNumber,
        year: year,
        coordinates: coordinates,
        criteria: criteria,
      );
      if (kDebugMode) print('Suggested timesheet for week $weekNumber, year $year');
      return result;
    } catch (e) {
      _errorMessage = 'Failed to suggest timesheet: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> cancelTimesheetSuggestion(String requestId) async {
    if (kDebugMode) print('TimesheetProvider.cancelTimesheetSuggestion called for $requestId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await TimesheetService.cancelTimesheetSuggestion(requestId);
      if (kDebugMode) print('Cancelled timesheet suggestion: $requestId');
    } catch (e) {
      _errorMessage = 'Failed to cancel timesheet suggestion: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> syncTimesheetToCalendar(String timesheetId) async {
    if (kDebugMode) print('TimesheetProvider.syncTimesheetToCalendar called for $timesheetId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await TimesheetService.syncTimesheetToCalendar(timesheetId);
      if (kDebugMode) print('Synced timesheet to calendar: $timesheetId');
      return result;
    } catch (e) {
      _errorMessage = 'Failed to sync timesheet to calendar: $e';
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