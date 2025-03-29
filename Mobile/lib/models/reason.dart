import 'package:TraceFlow/models/visit_reason.dart';

class Reason {
  final String? reasonID;
  final String item;
  final VisitReason? visitReason;

  Reason({
    this.reasonID,
    required this.item,
    this.visitReason,
  });

  factory Reason.fromJson(Map<String, dynamic> json) {
    return Reason(
      reasonID: json['reasonID'] as String?,
      item: json['item'] as String,
      visitReason: json['VisitReasons'] != null
          ? VisitReason.fromJson(json['VisitReasons'] as Map<String, dynamic>)
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