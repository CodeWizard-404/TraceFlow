import 'package:visit_management/models/visit.dart';

class Timesheet {
  final String? timesheetID;
  final int? weekNumber;
  final int? year;
  late final String? status;
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
      visits: (json['Visits'] as List?) // Fixed key name here
          ?.map((v) => Visit.fromJson(v))
          .toList() ?? [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'timesheetID': timesheetID,
      'weekNumber': weekNumber,
      'year': year,
      'status': status,
      'supervisorID': supervisorID,
      'Visits': visits?.map((v) => v.toJson()).toList(),
    };
  }
}