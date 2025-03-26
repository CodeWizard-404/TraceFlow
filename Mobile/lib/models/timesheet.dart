import 'package:TraceFlow/models/visit.dart';

class Timesheet {
  final String? timesheetID;
  final int? weekNumber;
  final int? year;
  final String? status;
  final String? supervisorID;
  final List<Visit>? visits;

  Timesheet({
    this.timesheetID,
    this.weekNumber,
    this.year,
    this.status,
    this.supervisorID,
    this.visits,
  });

  factory Timesheet.fromJson(Map<String, dynamic> json) {
    return Timesheet(
      timesheetID: json['timesheetID'],
      weekNumber: json['weekNumber'],
      year: json['year'],
      status: json['status'],
      supervisorID: json['supervisorID'],
      visits: (json['Visits'] as List?)
          ?.map((e) => Visit.fromJson(e))
          .toList(),
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