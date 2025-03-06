import 'package:visit_management/models/visit_checklist.dart';
import 'package:visit_management/models/visit_reason.dart';

class Visit {
  final String? visitID;
  final DateTime? date;
  final String? time;
  final String? location;
  final int? duration;
  final List<VisitChecklist>? checklist;
  final List<VisitReason>? reasons;
  final String? agentID;
  final String? timesheetID;
  final String? status;

  Visit({
    this.visitID,
    this.date,
    this.time,
    this.location,
    this.duration,
    this.checklist,
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
      checklist: (json['checklist'] as List?)
          ?.map((item) => VisitChecklist.fromJson(item))
          .toList(),
      reasons: (json['reasons'] as List?)
          ?.map((item) => VisitReason.fromJson(item))
          .toList(),
      agentID: json['agentID'],
      timesheetID: json['timesheetID'],
      status: json['status'],
    );
  }

  Map<String, dynamic> toJson() => {
    'visitID': visitID,
    'date': date?.toIso8601String().split('T')[0],
    'time': time,
    'location': location,
    'duration': duration,
    'reasons': reasons?.map((r) => r.reasonID).toList(),
    'checklist': checklist?.map((c) => c.checklistID).toList(), // Send only IDs for creation
    'agentID': agentID,
    'timesheetID': timesheetID,
    'status': status,
  };
}