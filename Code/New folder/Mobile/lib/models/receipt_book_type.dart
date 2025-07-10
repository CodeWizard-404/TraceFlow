class ReceiptBookType {
  final String typeID;
  final String name;

  ReceiptBookType({
    required this.typeID,
    required this.name,
  });

  factory ReceiptBookType.fromJson(Map<String, dynamic> json) {
    return ReceiptBookType(
      typeID: json['typeID'] as String,
      name: json['name'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'typeID': typeID,
      'name': name,
    };
  }
}