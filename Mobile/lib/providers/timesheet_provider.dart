import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../models/timesheet.dart';
import '../services/timesheet_service.dart';

class TimesheetProvider with ChangeNotifier {
  List<Timesheet> _timesheets = [];
  Timesheet? _currentTimesheet;

  List<Timesheet> get timesheets => _timesheets;
  Timesheet? get currentTimesheet => _currentTimesheet;

  Future<void> fetchTimesheets() async {
    try {
      _timesheets = await TimesheetService.fetchAllTimesheets();
      notifyListeners();
    } catch (e) {
      throw Exception('Failed to fetch timesheets: $e');
    }
  }

  Future<void> createTimesheet({
    required int weekNumber,
    required int year,
    required String supervisorID,
    required List<Map<String, dynamic>> visits,
  }) async {
    try {
      final response = await TimesheetService.createTimesheet({
        'weekNumber': weekNumber,
        'year': year,
        'supervisorID': supervisorID,
        'visits': visits.map((v) => {
          'date': v['date'],
          'time': v['time'],
          'agentID': v['agentID'],
          'location': v['location'],
          'reasons': v['reasons'],
          'checklists': v['checklists'],
        }).toList(),
      });

      if (response.statusCode == 201) {
        // Refresh the timesheets list to include the new timesheet and its visits
        await fetchTimesheets();
      } else {
        throw Exception('Failed to create timesheet: ${json.decode(response.body)}');
      }
    } catch (e) {
      throw Exception('Error creating timesheet: $e');
    }
  }

  Future<void> fetchTimesheetById(String id) async {
    try {
      _currentTimesheet = await TimesheetService.fetchTimesheetById(id);
      notifyListeners();
    } catch (e) {
      throw Exception('Failed to fetch timesheet: $e');
    }
  }

  Future<void> fetchTimesheetsBySupervisor(String supervisorID) async {
    try {
      _timesheets = await TimesheetService.fetchTimesheetsBySupervisor(supervisorID);
      notifyListeners();
    } catch (e) {
      throw Exception('Failed to fetch timesheets by supervisor: $e');
    }
  }

  void setCurrentTimesheet(Timesheet timesheet) {
    _currentTimesheet = timesheet;
    notifyListeners();
  }
}