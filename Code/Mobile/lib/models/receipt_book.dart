import 'package:TraceFlow/models/receipt_stub.dart';

class ReceiptBook {
  final String bookID;
  final String number;
  final String status;
  final String qrCode;
  final String? currentHolderID;
  final String? agentID;
  final String typeID;
  final ReceiptStub? receiptStub;

  ReceiptBook({
    required this.bookID,
    required this.number,
    required this.status,
    required this.qrCode,
    this.currentHolderID,
    this.agentID,
    required this.typeID,
    this.receiptStub,
  });

  factory ReceiptBook.fromJson(Map<String, dynamic> json) {
    return ReceiptBook(
      bookID: json['bookID'] as String,
      number: json['number'] as String,
      status: json['status'] as String,
      qrCode: 'data:image/png;base64,${json['qrCode'] as String}',
      currentHolderID: json['currentHolderID'] as String?,
      agentID: json['agentID'] as String?,
      typeID: json['typeID'] as String,
      receiptStub: json['ReceiptStub'] != null ? ReceiptStub.fromJson(json['ReceiptStub'] as Map<String, dynamic>) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'bookID': bookID,
      'number': number,
      'status': status,
      'qrCode': qrCode.startsWith('data:image/png;base64,') ? qrCode.substring('data:image/png;base64,'.length) : qrCode,
      'currentHolderID': currentHolderID,
      'agentID': agentID,
      'typeID': typeID,
      'ReceiptStub': receiptStub?.toJson(),
    };
  }
}