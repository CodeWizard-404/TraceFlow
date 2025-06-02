import 'package:TraceFlow/models/reason.dart';
import 'package:TraceFlow/models/checklist.dart';

class Visit {
  final String visitID;
  final DateTime date;
  final String time;
  final int? duration;
  final String? location;
  final String status;
  final List<String>? photos;
  final String? comment;
  final String agentID;
  final String timesheetID;
  final String? calendarEventId;
  final List<Checklist>? checklists;
  final List<Reason>? reasons;

  Visit({
    required this.visitID,
    required this.date,
    required this.time,
    this.duration,
    this.location,
    required this.status,
    this.photos,
    this.comment,
    required this.agentID,
    required this.timesheetID,
    this.calendarEventId,
    this.checklists,
    this.reasons,
  });

  factory Visit.fromJson(Map<String, dynamic> json) {
    return Visit(
      visitID: json['visitID'] as String,
      date: DateTime.parse(json['date'] as String),
      time: json['time'] as String,
      duration: json['duration'] as int?,
      location: json['location'] as String?,
      status: json['status'] as String,
      photos: (json['photos'] as List<dynamic>?)?.cast<String>(),
      comment: json['comment'] as String?,
      agentID: json['agentID'] as String,
      timesheetID: json['timesheetID'] as String,
      calendarEventId: json['calendarEventId'] as String?,
      checklists: (json['Checklists'] as List<dynamic>?)?.map((e) => Checklist.fromJson(e as Map<String, dynamic>)).toList(),
      reasons: (json['Reasons'] as List<dynamic>?)?.map((e) => Reason.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'visitID': visitID,
      'date': date.toIso8601String().split('T')[0],
      'time': time,
      'duration': duration,
      'location': location,
      'status': status,
      'photos': photos,
      'comment': comment,
      'agentID': agentID,
      'timesheetID': timesheetID,
      'calendarEventId': calendarEventId,
      'Checklists': checklists?.map((e) => e.toJson()).toList(),
      'Reasons': reasons?.map((e) => e.toJson()).toList(),
    };
  }
}