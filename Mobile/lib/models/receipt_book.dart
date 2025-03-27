// lib/models/receipt_book.dart
class ReceiptBook {
  final String? bookID;
  final String? number;
  final String? type;
  final String? status; // e.g., "With Supervisor", "Assigned to Agent"
  final String? currentHolderID; // Supervisor's userID when held
  final String? agentID; // Agent assigned to, if applicable

  ReceiptBook({
    this.bookID,
    this.number,
    this.type,
    this.status,
    this.currentHolderID,
    this.agentID,
  });

  factory ReceiptBook.fromJson(Map<String, dynamic> json) {
    return ReceiptBook(
      bookID: json['bookID'] as String?,
      number: json['number'] as String?,
      type: json['type'] as String?,
      status: json['status'] as String?,
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
      'currentHolderID': currentHolderID,
      'agentID': agentID,
    };
  }
}