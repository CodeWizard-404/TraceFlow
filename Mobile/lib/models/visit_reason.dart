class VisitReason {
  final String visitID;
  final String reasonID;

  VisitReason({
    required this.visitID,
    required this.reasonID,
  });

  factory VisitReason.fromJson(Map<String, dynamic> json) {
    return VisitReason(
      visitID: json['VisitID'],
      reasonID: json['ReasonID'],
    );
  }
}