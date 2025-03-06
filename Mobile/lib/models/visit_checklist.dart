class VisitChecklist {
  final String visitID;
  final String checklistID;
  final bool checked;

  VisitChecklist({
    required this.visitID,
    required this.checklistID,
    required this.checked,
  });

  factory VisitChecklist.fromJson(Map<String, dynamic> json) {
    return VisitChecklist(
      visitID: json['VisitID'],
      checklistID: json['ChecklistID'],
      checked: json['Checked'],
    );
  }
}