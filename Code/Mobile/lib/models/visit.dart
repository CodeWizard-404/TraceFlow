import 'package:TraceFlow/models/reason.dart';
import 'package:flutter/foundation.dart';

import 'agent.dart';
import 'checklist.dart';

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
  final DateTime? createdAt; // Changed to nullable
  final DateTime? updatedAt; // Changed to nullable
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
    this.createdAt, // No longer required
    this.updatedAt, // No longer required
    this.checklists,
    this.reasons,
    this.agent,
  });

  factory Visit.fromJson(Map<String, dynamic> json) {
    if (kDebugMode) print('Visit.fromJson called with data: ${json.toString().substring(0, 100)}...');
    try {
      String timeStr = json['time'] as String;
      // Standardize time to 'HH:mm'
      List<String> timeParts = timeStr.split(':');
      if (timeParts.length >= 2) {
        String hour = timeParts[0].padLeft(2, '0');
        String minute = timeParts[1].padLeft(2, '0');
        timeStr = '$hour:$minute';
      }
      return Visit(
        visitID: json['visitID'] as String,
        date: DateTime.parse(json['date'] as String),
        time: timeStr,
        duration: json['duration'] as int?,
        location: json['location'] as String?,
        status: json['status'] as String?,
        photos: (json['photos'] as List<dynamic>?)?.cast<String>(),
        comment: json['comment'] as String?,
        agentID: json['agentID'] as String?,
        timesheetID: json['timesheetID'] as String?,
        calendarEventId: json['calendarEventId'] as String?,
        createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt'] as String) : null,
        updatedAt: json['updatedAt'] != null ? DateTime.parse(json['updatedAt'] as String) : null,
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
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
      'Checklists': checklists?.map((e) => e.toJson()).toList(),
      'Reasons': reasons?.map((e) => e.toJson()).toList(),
      'Agent': agent?.toJson(),
    };
  }
}