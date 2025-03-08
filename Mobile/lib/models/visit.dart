import 'package:visit_management/models/reason.dart';
import 'package:visit_management/models/visit_checklist.dart';
import 'package:visit_management/models/visit_reason.dart';

import 'checklist.dart';

class Visit {
  final String? visitID;
  final DateTime? date;
  final String? time;
  final String? location;
  final int? duration;
  final List<Checklist>? checklists;
  final List<Reason>? reasons;
  final String? agentID;
  final String? timesheetID;
  final String? status;

  Visit({
    this.visitID,
    this.date,
    this.time,
    this.location,
    this.duration,
    this.checklists,
    this.reasons,
    this.agentID,
    this.timesheetID,
    this.status,
  });

  factory Visit.fromJson(Map<String, dynamic> json) {
    return Visit(
      visitID: json['visitID'],
      date: json['date'] != null ? DateTime.parse(json['date']) : null,
      time: json['time'],
      location: json['location'],
      duration: json['duration'],
      checklists: (json['Checklists'] as List?)
          ?.map((e) => Checklist.fromJson(e)) // Convert to Checklist objects
          .toList(),
      reasons: (json['Reasons'] as List?)
          ?.map((e) => Reason.fromJson(e)) // Convert to Reason objects
          .toList(),
      agentID: json['agentID'] as String?,
      timesheetID: json['timesheetID'],
      status: json['status'],
    );
  }

  Map<String, dynamic> toJson() => {
    'visitID': visitID,
    'date': date?.toIso8601String(),
    'time': time,
    'location': location,
    'duration': duration,
    'Checklists': checklists?.map((c) => c.checklistID).toList(),
    'Reasons': reasons?.map((r) => r.reasonID).toList(),
    'agentID': agentID,
    'timesheetID': timesheetID,
    'status': status,
  };
}