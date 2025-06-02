import 'package:flutter/foundation.dart';
import 'agent.dart';
import 'checklist.dart';
import 'reason.dart';

class Visit {
  final String visitID;
  final DateTime date;
  final String time;
  final int? duration;
  final String? location;
  final String? status;
  final List<String>? photos;
  final String? comment;
  final String? agentID;
  final String? timesheetID;
  final String? calendarEventId;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<Checklist>? checklists;
  final List<Reason>? reasons;
  final Agent? agent;

  Visit({
    required this.visitID,
    required this.date,
    required this.time,
    this.duration,
    this.location,
    this.status,
    this.photos,
    this.comment,
    this.agentID,
    this.timesheetID,
    this.calendarEventId,
    required this.createdAt,
    required this.updatedAt,
    this.checklists,
    this.reasons,
    this.agent,
  });

  factory Visit.fromJson(Map<String, dynamic> json) {
    if (kDebugMode) print('Visit.fromJson called with data: ${json.toString().substring(0, 100)}...');
    try {
      return Visit(
        visitID: json['visitID'] as String,
        date: DateTime.parse(json['date'] as String),
        time: json['time'] as String,
        duration: json['duration'] as int?,
        location: json['location'] as String?,
        status: json['status'] as String?,
        photos: (json['photos'] as List<dynamic>?)?.cast<String>(),
        comment: json['comment'] as String?,
        agentID: json['agentID'] as String?,
        timesheetID: json['timesheetID'] as String?,
        calendarEventId: json['calendarEventId'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        checklists: (json['Checklists'] as List<dynamic>?)?.map((e) => Checklist.fromJson(e as Map<String, dynamic>)).toList(),
        reasons: (json['Reasons'] as List<dynamic>?)?.map((e) => Reason.fromJson(e as Map<String, dynamic>)).toList(),
        agent: json['Agent'] != null ? Agent.fromJson(json['Agent'] as Map<String, dynamic>) : null,
      );
    } catch (e) {
      if (kDebugMode) print('Error parsing Visit: $e');
      rethrow;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'visitID': visitID,
      'date': date.toIso8601String(),
      'time': time,
      'duration': duration,
      'location': location,
      'status': status,
      'photos': photos,
      'comment': comment,
      'agentID': agentID,
      'timesheetID': timesheetID,
      'calendarEventId': calendarEventId,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'Checklists': checklists?.map((e) => e.toJson()).toList(),
      'Reasons': reasons?.map((e) => e.toJson()).toList(),
      'Agent': agent?.toJson(),
    };
  }
}