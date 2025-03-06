class Reason {
  final String reasonID;
  final String item;

  Reason({
    required this.reasonID,
    required this.item,
  });

  factory Reason.fromJson(Map<String, dynamic> json) {
    return Reason(
      reasonID: json['reasonID'],
      item: json['item'],
    );
  }
}