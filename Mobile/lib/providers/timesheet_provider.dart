import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../models/timesheet.dart';
import '../services/timesheet_service.dart';

class TimesheetProvider with ChangeNotifier {
  List<Timesheet> _timesheets = [];
  Timesheet? _currentTimesheet;

  List<Timesheet> get timesheets => _timesheets;
  Timesheet? get currentTimesheet => _currentTimesheet;

  // Fetch all timesheets
  Future<void> fetchTimesheets() async {
    try {
      // Fetch timesheets using the service
      final timesheets = await TimesheetService.fetchAllTimesheets();
      _timesheets = timesheets;
      notifyListeners();
    } catch (e) {
      print('Error fetching timesheets: $e');
      throw Exception('Failed to fetch timesheets');
    }
  }

  // Create a new timesheet or add visits to an existing one
  Future<void> createTimesheet(int weekNumber, int year, String supervisorID, List<Map<String, dynamic>> visits) async {
    try {
      final response = await TimesheetService.createTimesheet({
        'weekNumber': weekNumber,
        'year': year,
        'supervisorID': supervisorID,
        'visits': visits,
      });

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception('Failed to create timesheet: ${response.body}');
      }

      // Parse the response and update the local state
      final responseData = jsonDecode(response.body);
      print('Timesheet created successfully: $responseData');
      notifyListeners();
    } catch (e) {
      print('Error creating timesheet: $e');
      throw Exception('Failed to create timesheet');
    }
  }

  // Fetch a specific timesheet by ID
  Future<void> fetchTimesheetById(String id) async {
    try {
      _currentTimesheet = await TimesheetService.fetchTimesheetById(id);
      notifyListeners();
    } catch (error) {
      throw Exception('Failed to fetch timesheet: $error');
    }
  }

  // Fetch timesheets by supervisor
  Future<void> fetchTimesheetsBySupervisor(String supervisorID) async {
    try {
      final timesheets = await TimesheetService.fetchTimesheetsBySupervisor(supervisorID);
      _timesheets = timesheets;
      notifyListeners();
    } catch (error) {
      throw Exception('Failed to fetch timesheets by supervisor: $error');
    }
  }

  void setCurrentTimesheet(Timesheet timesheet) {
    _currentTimesheet = timesheet;
    notifyListeners();
  }
}