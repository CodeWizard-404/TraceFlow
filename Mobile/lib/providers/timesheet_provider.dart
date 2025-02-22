import 'package:flutter/foundation.dart';
import '../models/timesheet.dart';
import '../models/visit.dart';
import '../services/api_service.dart';

class TimesheetProvider with ChangeNotifier {
  List<Timesheet> _timesheets = [];
  Timesheet? _currentTimesheet;

  List<Timesheet> get timesheets => _timesheets;
  Timesheet? get currentTimesheet => _currentTimesheet;

  // Fetch all timesheets
  Future<void> fetchTimesheets() async {
    try {
      final response = await ApiService.getTimesheets();
      _timesheets = (response).map((json) => Timesheet.fromJson(json)).toList();
      notifyListeners();
    } catch (error) {
      throw Exception('Failed to fetch timesheets: $error');
    }
  }

  // Create a new timesheet or add visits to an existing one
  Future<void> createTimesheet(int weekNumber, int year, String supervisorID, List<Map<String, dynamic>> visitsData) async {
    try {
      // Prepare the timesheet data for the API call
      final timesheetData = {
        'weekNumber': weekNumber,
        'year': year,
        'supervisorID': supervisorID,
        'visits': visitsData, // Pass visitsData as-is for the API
      };

      // Call the API to create the timesheet
      await ApiService.postTimesheet(timesheetData);

      // Convert visitsData to List<Visit> for the Timesheet model
      final visits = visitsData.map((v) => Visit.fromJson(v)).toList();

      // Create a new Timesheet object
      final newTimesheet = Timesheet(
        timesheetID: DateTime.now().millisecondsSinceEpoch.toString(),
        weekNumber: weekNumber,
        year: year,
        status: 'pending',
        supervisorID: supervisorID,
        visits: visits, // Pass the converted List<Visit>
      );

      // Update the state
      _timesheets.add(newTimesheet);
      _currentTimesheet = newTimesheet;
      notifyListeners();
    } catch (error) {
      throw Exception('Failed to create timesheet: $error');
    }
  }
  // Fetch a specific timesheet by ID
  Future<void> fetchTimesheetById(String id) async {
    try {
      final response = await ApiService.getTimesheetById(id);
      final timesheet = Timesheet.fromJson(response);
      _currentTimesheet = timesheet;
      notifyListeners();
    } catch (error) {
      throw Exception('Failed to fetch timesheet: $error');
    }
  }

  // Validate a timesheet (fully or partially)
  Future<void> validateTimesheet(String id, List<String> visitIDs, String status) async {
    try {
      final validationData = {
        'visitIDs': visitIDs,
        'status': status,
      };
      await ApiService.validateTimesheet(id, validationData);

      final timesheetIndex = _timesheets.indexWhere((t) => t.timesheetID == id);
      if (timesheetIndex != -1) {
        _timesheets[timesheetIndex].status = status;
        notifyListeners();
      }
    } catch (error) {
      throw Exception('Failed to validate timesheet: $error');
    }
  }

  void setCurrentTimesheet(Timesheet timesheet) {
    _currentTimesheet = timesheet;
    notifyListeners();
  }
}