class ReceiptBook {
  final String? bookID;
  final String number;         // Required
  final String type;           // Required
  final String status;         // Required
  final String qrCode;         // Required
  final String? currentHolderID;
  final String? agentID;

  ReceiptBook({
    this.bookID,
    required this.number,
    required this.type,
    required this.status,
    required this.qrCode,
    this.currentHolderID,
    this.agentID,
  });

  factory ReceiptBook.fromJson(Map<String, dynamic> json) {
    return ReceiptBook(
      bookID: json['bookID'] as String?,
      number: json['number'] as String,
      type: json['type'] as String,
      status: json['status'] as String,
      qrCode: json['qrCode'] as String,
      currentHolderID: json['currentHolderID'] as String?,
      agentID: json['agentID'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'bookID': bookID,
      'number': number,
      'type': type,
      'status': status,
      'qrCode': qrCode,
      'currentHolderID': currentHolderID,
      'agentID': agentID,
    };
  }
}