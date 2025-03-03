class Visit {
  final String? visitID;
  final DateTime? date;
  final String? time;
  final String? location;
  final int? duration;
  final List<String>? reasons;
  final List<String>? checklist;
  final String? agentID;
  final String? timesheetID;
  final String? status;

  Visit({
    this.visitID,
    this.date,
    this.time,
    this.location,
    this.duration,
    this.reasons,
    this.checklist,
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
      reasons: json['reason'] != null ? List<String>.from(json['reason']) : [],
      checklist: json['checklist'] != null ? List<String>.from(json['checklist']) : [],
      agentID: json['agentID'],
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
    'reason': reasons,
    'checklist': checklist,
    'agentID': agentID,
    'timesheetID': timesheetID,
    'status': status,
  };
}