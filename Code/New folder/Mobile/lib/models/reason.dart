import 'package:TraceFlow/models/visit_reason.dart';

class Reason {
  final String reasonID;
  final String item;
  final VisitReason? visitReasons; // Changed from List<VisitReason>? to VisitReason?

  Reason({
    required this.reasonID,
    required this.item,
    this.visitReasons,
  });

  factory Reason.fromJson(Map<String, dynamic> json) {
    return Reason(
      reasonID: json['reasonID'] as String,
      item: json['item'] as String,
      visitReasons: json['VisitReasons'] != null
          ? VisitReason.fromJson(json['VisitReasons'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'reasonID': reasonID,
      'item': item,
      'VisitReasons': visitReasons?.toJson(),
    };
  }
}