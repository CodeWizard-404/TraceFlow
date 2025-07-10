class ReceiptStub {
  final String stubID;
  final String status;

  ReceiptStub({
    required this.stubID,
    required this.status,
  });

  factory ReceiptStub.fromJson(Map<String, dynamic> json) {
    return ReceiptStub(
      stubID: json['stubID'] as String,
      status: json['status'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'stubID': stubID,
      'status': status,
    };
  }
}