import 'package:TraceFlow/models/visit_checklist.dart';

class Checklist {
  final String? checklistID;
  final String? item;
  final VisitChecklist? visitChecklist;

  Checklist({
    this.checklistID,
    this.item,
    this.visitChecklist,
  });

  factory Checklist.fromJson(Map<String, dynamic> json) {
    return Checklist(
      checklistID: json['checklistID'],
      item: json['item'],
      visitChecklist: json['VisitChecklist'] != null
          ? VisitChecklist.fromJson(json['VisitChecklist'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'checklistID': checklistID,
      'item': item,
      'VisitChecklist': visitChecklist?.toJson(),
    };
  }
}
