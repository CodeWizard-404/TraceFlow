import 'package:TraceFlow/models/visit.dart';

class Timesheet {
  final String timesheetID;
  final int weekNumber;
  final int year;
  final String status;
  final String supervisorID;
  final List<Visit>? visits;

  Timesheet({
    required this.timesheetID,
    required this.weekNumber,
    required this.year,
    required this.status,
    required this.supervisorID,
    this.visits,
  });

  factory Timesheet.fromJson(Map<String, dynamic> json) {
    return Timesheet(
      timesheetID: json['timesheetID'] as String,
      weekNumber: json['weekNumber'] as int,
      year: json['year'] as int,
      status: json['status'] as String,
      supervisorID: json['supervisorID'] as String,
      visits: (json['Visits'] as List<dynamic>?)?.map((e) => Visit.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'timesheetID': timesheetID,
      'weekNumber': weekNumber,
      'year': year,
      'status': status,
      'supervisorID': supervisorID,
      'Visits': visits?.map((e) => e.toJson()).toList(),
    };
  }
}