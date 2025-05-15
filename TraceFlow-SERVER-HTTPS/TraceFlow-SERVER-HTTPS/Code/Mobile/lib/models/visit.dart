import 'package:TraceFlow/models/reason.dart';
import 'package:TraceFlow/models/checklist.dart';

class Visit {
  final String? visitID;
  final DateTime date;
  final String time;
  final String? location;
  final int? duration;
  final List<Checklist>? checklists;
  final List<Reason>? reasons;
  final String agentID;
  final String timesheetID;
  final String status;
  final List<String>? photos;
  final String? comment;

  Visit({
    this.visitID,
    required this.date,
    required this.time,
    this.location,
    this.duration,
    this.checklists,
    this.reasons,
    required this.agentID,
    required this.timesheetID,
    required this.status,
    this.photos,
    this.comment,
  });

  factory Visit.fromJson(Map<String, dynamic> json) {
    return Visit(
      visitID: json['visitID'] as String?,
      date: DateTime.parse(json['date'] as String),
      time: json['time'] as String,
      location: json['location'] as String?,
      duration: json['duration'] as int?,
      checklists: (json['Checklists'] as List<dynamic>?)
          ?.map((e) => Checklist.fromJson(e as Map<String, dynamic>))
          .toList(),
      reasons: (json['Reasons'] as List<dynamic>?)
          ?.map((e) => Reason.fromJson(e as Map<String, dynamic>))
          .toList(),
      agentID: json['agentID'] as String,
      timesheetID: json['timesheetID'] as String,
      status: json['status'] as String,
      photos:List<String>.from(json['photos'] ?? [] ),
      comment: json['comment'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'visitID': visitID,
      'date': date.toIso8601String().split('T')[0], // DateOnly format
      'time': time,
      'location': location,
      'duration': duration,
      'Checklists': checklists?.map((e) => e.toJson()).toList(),
      'Reasons': reasons?.map((e) => e.toJson()).toList(),
      'agentID': agentID,
      'timesheetID': timesheetID,
      'status': status,
      'photos': photos,
      'comment': comment,
    };
  }
}