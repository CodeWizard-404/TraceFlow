class ReceiptBookTransfer {
  final String? transferID;
  final String bookID;         // Required
  final String? fromUserID;
  final String? toUserID;
  final String? toAgentID;
  final String status;         // Required
  final String transferType;   // Required
  final DateTime transferDate; // Required

  ReceiptBookTransfer({
    this.transferID,
    required this.bookID,
    this.fromUserID,
    this.toUserID,
    this.toAgentID,
    required this.status,
    required this.transferType,
    required this.transferDate,
  });

  factory ReceiptBookTransfer.fromJson(Map<String, dynamic> json) {
    return ReceiptBookTransfer(
      transferID: json['transferID'] as String?,
      bookID: json['bookID'] as String,
      fromUserID: json['fromUserID'] as String?,
      toUserID: json['toUserID'] as String?,
      toAgentID: json['toAgentID'] as String?,
      status: json['status'] as String,
      transferType: json['transferType'] as String,
      transferDate: DateTime.parse(json['transferDate'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'transferID': transferID,
      'bookID': bookID,
      'fromUserID': fromUserID,
      'toUserID': toUserID,
      'toAgentID': toAgentID,
      'status': status,
      'transferType': transferType,
      'transferDate': transferDate.toIso8601String(),
    };
  }
}