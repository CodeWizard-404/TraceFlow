class VisitChecklist {
  final bool checked;
  final String visitID;
  final String checklistID;

  VisitChecklist({
    required this.checked,
    required this.visitID,
    required this.checklistID,
  });

  factory VisitChecklist.fromJson(Map<String, dynamic> json) {
    return VisitChecklist(
      checked: json['checked'] as bool,
      visitID: json['visitID'] as String,
      checklistID: json['checklistID'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'checked': checked,
      'visitID': visitID,
      'checklistID': checklistID,
    };
  }
}