import 'package:TraceFlow/models/visit_reason.dart';

class Reason {
  final String reasonID;
  final String item;
  final List<VisitReason>? visitReasons;

  Reason({
    required this.reasonID,
    required this.item,
    this.visitReasons,
  });

  factory Reason.fromJson(Map<String, dynamic> json) {
    return Reason(
      reasonID: json['reasonID'] as String,
      item: json['item'] as String,
      visitReasons: (json['VisitReasons'] as List<dynamic>?)?.map((e) => VisitReason.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'reasonID': reasonID,
      'item': item,
      'VisitReasons': visitReasons?.map((e) => e.toJson()).toList(),
    };
  }
}