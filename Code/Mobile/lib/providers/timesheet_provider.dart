import 'package:flutter/foundation.dart';
import '../models/timesheet.dart';
import '../models/visit.dart';
import '../services/timesheet_service.dart';

class TimesheetProvider with ChangeNotifier {
  List<Timesheet> _timesheets = [];
  Timesheet? _currentTimesheet;
  List<Visit> _suggestedVisits = [];
  List<String> _selectedSuggestedVisitIds = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<Timesheet> get timesheets => _timesheets;
  Timesheet? get currentTimesheet => _currentTimesheet;
  List<Visit> get suggestedVisits => _suggestedVisits;
  List<String> get selectedSuggestedVisitIds => _selectedSuggestedVisitIds;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  void setSuggestedVisits(List<Visit> visits) {
    _suggestedVisits = visits;
    _selectedSuggestedVisitIds = visits.map((v) => v.visitID).toList();
    notifyListeners();
  }

  void toggleSuggestedVisitSelection(String visitID) {
    if (_selectedSuggestedVisitIds.contains(visitID)) {
      _selectedSuggestedVisitIds.remove(visitID);
    } else {
      _selectedSuggestedVisitIds.add(visitID);
    }
    notifyListeners();
  }

  void selectAllSuggestedVisits() {
    _selectedSuggestedVisitIds = _suggestedVisits.map((v) => v.visitID).toList();
    notifyListeners();
  }

  void clearSuggestedVisits() {
    _suggestedVisits = [];
    _selectedSuggestedVisitIds = [];
    notifyListeners();
  }

  Future<void> saveSuggestedVisits(String supervisorID) async {
    _isLoading = true;
    notifyListeners();
    try {
      final selectedVisits = _suggestedVisits
          .where((v) => _selectedSuggestedVisitIds.contains(v.visitID))
          .toList();
      for (var visit in selectedVisits) {
        final date = visit.date;
        final weekNumber = _getWeekNumber(date);
        await createTimesheetForSupervisor(
          weekNumber: weekNumber,
          year: date.year,
          supervisorID: supervisorID,
          visits: [visit.toJson()],
          status: 'pending',
        );
      }
      clearSuggestedVisits();
    } catch (e) {
      _errorMessage = 'Failed to save suggestions: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    final firstMonday = startOfYear.weekday <= 4
        ? startOfYear.subtract(Duration(days: startOfYear.weekday - 1))
        : startOfYear.add(Duration(days: 8 - startOfYear.weekday));
    return (date.difference(firstMonday).inDays ~/ 7) + 1;
  }

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
      // Default criteria with time interval
      final defaultCriteria = {
        'time_interval': {
          'start_time': '08:00',
          'end_time': '17:00',
        },
      };
      final result = await TimesheetService.suggestTimesheet(
        supervisorID: supervisorID,
        weekNumber: weekNumber,
        year: year,
        coordinates: coordinates,
        criteria: criteria ?? defaultCriteria,
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