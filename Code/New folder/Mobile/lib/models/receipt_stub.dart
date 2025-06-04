class ReceiptStub {
  final String stubID;
  final String bookID;
  final String status;

  ReceiptStub({
    required this.stubID,
    required this.bookID,
    required this.status,
  });

  factory ReceiptStub.fromJson(Map<String, dynamic> json) {
    return ReceiptStub(
      stubID: json['stubID'] as String,
      bookID: json['bookID'] as String,
      status: json['status'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'stubID': stubID,
      'bookID': bookID,
      'status': status,
    };
  }
}