class VisitReason {
  final String visitID;
  final String reasonID;

  VisitReason({
    required this.visitID,
    required this.reasonID,
  });

  factory VisitReason.fromJson(Map<String, dynamic> json) {
    return VisitReason(
      visitID: json['visitID'] as String,
      reasonID: json['reasonID'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'visitID': visitID,
      'reasonID': reasonID,
    };
  }
}