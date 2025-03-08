class VisitChecklist {
  final bool? checked;
  final String visitID;
  final String checklistID;

  VisitChecklist({
    this.checked,
    required this.visitID,
    required this.checklistID,
  });

  factory VisitChecklist.fromJson(Map<String, dynamic> json) {
    return VisitChecklist(
      checked: json['checked'],
      visitID: json['visitID'],
      checklistID: json['checklistID'],
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
