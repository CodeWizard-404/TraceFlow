import 'package:visit_management/models/visit.dart';

class Timesheet {
  final String? timesheetID;
  final int? weekNumber;
  final int? year;
  late final String? status;
  final String? supervisorID;
  final List<Visit>? visits;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Timesheet({
    this.timesheetID,
    this.weekNumber,
    this.year,
    this.status,
    this.supervisorID,
    this.visits,
    this.createdAt,
    this.updatedAt,
  });

  factory Timesheet.fromJson(Map<String, dynamic> json) {
    return Timesheet(
      timesheetID: json['timesheetID'],
      weekNumber: json['weekNumber'],
      year: json['year'],
      status: json['status'],
      supervisorID: json['supervisorID'],
      visits: json['Visits'] != null && json['Visits'] is List
          ? (json['Visits'] as List).map((v) => Visit.fromJson(v)).toList()
          : [], // Default to empty list if Visits is null
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'timesheetID': timesheetID,
      'weekNumber': weekNumber,
      'year': year,
      'status': status,
      'supervisorID': supervisorID,
      'visits': visits?.map((v) => v.toJson()).toList(),
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}