class VisitChecklist {
  final bool? checked;
  final String visitID;
  final String reasonID;

  VisitChecklist({
    this.checked,
    required this.visitID,
    required this.reasonID,
  });

  factory VisitChecklist.fromJson(Map<String, dynamic> json) {
    return VisitChecklist(
      checked: json['checked'],
      visitID: json['visitID'],
      reasonID: json['reasonID'],
    );
  }
}