class Checklist {
  final String checklistID;
  final String item;

  Checklist({
    required this.checklistID,
    required this.item,
  });

  factory Checklist.fromJson(Map<String, dynamic> json) {
    return Checklist(
      checklistID: json['checklistID'],
      item: json['item'],
    );
  }
}