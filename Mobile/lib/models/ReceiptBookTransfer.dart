// lib/models/receipt_book_transfer.dart
class ReceiptBookTransfer {
  final String? transferID;
  final String? bookID;
  final String? fromUserID; // Sender (e.g., supervisor)
  final String? toUserID; // Receiver (e.g., regional manager, stock manager)
  final String? toAgentID; // Receiver if agent
  final String? status; // "Pending", "Validated"
  final String? transferType; // e.g., "ToAgent", "StubToSupervisor"
  final DateTime? transferDate;

  ReceiptBookTransfer({
    this.transferID,
    this.bookID,
    this.fromUserID,
    this.toUserID,
    this.toAgentID,
    this.status,
    this.transferType,
    this.transferDate,
  });

  factory ReceiptBookTransfer.fromJson(Map<String, dynamic> json) {
    return ReceiptBookTransfer(
      transferID: json['transferID'] as String?,
      bookID: json['bookID'] as String?,
      fromUserID: json['fromUserID'] as String?,
      toUserID: json['toUserID'] as String?,
      toAgentID: json['toAgentID'] as String?,
      status: json['status'] as String?,
      transferType: json['transferType'] as String?,
      transferDate: json['transferDate'] != null
          ? DateTime.parse(json['transferDate'])
          : null,
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
      'transferDate': transferDate?.toIso8601String(),
    };
  }
}