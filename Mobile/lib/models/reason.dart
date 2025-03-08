import 'package:visit_management/models/visit_reason.dart';

class Reason {
  final String? reasonID;
  final String? item;
  final VisitReason? visitReason;

  Reason({
    this.reasonID,
    this.item,
    this.visitReason,
  });

  factory Reason.fromJson(Map<String, dynamic> json) {
    return Reason(
      reasonID: json['reasonID'],
      item: json['item'],
      visitReason: json['VisitReasons'] != null
          ? VisitReason.fromJson(json['VisitReasons'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'reasonID': reasonID,
      'item': item,
      'VisitReasons': visitReason?.toJson(),
    };
  }
}