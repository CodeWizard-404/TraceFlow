import 'package:TraceFlow/models/receipt_stub.dart';

class ReceiptBook {
  final String? bookID;
  final String number;
  final String type;
  final String status;
  final String qrCode;
  final String? currentHolderID;
  final String? agentID;
  final ReceiptStub? receiptStub;

  ReceiptBook({
    this.bookID,
    required this.number,
    required this.type,
    required this.status,
    required this.qrCode,
    this.currentHolderID,
    this.agentID,
    this.receiptStub,
  });

  factory ReceiptBook.fromJson(Map<String, dynamic> json) {
    return ReceiptBook(
      bookID: json['bookID'] as String?,
      number: json['number'] as String,
      type: json['type'] as String,
      status: json['status'] as String,
      qrCode: 'data:image/png;base64,${json['qrCode'] as String}',
      currentHolderID: json['currentHolderID'] as String?,
      agentID: json['agentID'] as String?,
      receiptStub: json['ReceiptStub'] != null
          ? ReceiptStub.fromJson(json['ReceiptStub'] as Map<String, dynamic>)
          : null, // Parse ReceiptStub
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'bookID': bookID,
      'number': number,
      'type': type,
      'status': status,
      'qrCode': qrCode.startsWith('data:image/png;base64,')
          ? qrCode.substring('data:image/png;base64,'.length)
          : qrCode,
      'currentHolderID': currentHolderID,
      'agentID': agentID,
      'ReceiptStub': receiptStub?.toJson(),
    };
  }
}

