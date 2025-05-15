class VisitReason {
  final String? visitID;
  final String? reasonID;

  VisitReason({
    this.visitID,
    this.reasonID,
  });

  factory VisitReason.fromJson(Map<String, dynamic> json) {
    return VisitReason(
      visitID: json['visitID'],
      reasonID: json['reasonID'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'visitID': visitID,
      'reasonID': reasonID,
    };
  }
}