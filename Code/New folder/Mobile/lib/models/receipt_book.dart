import 'package:flutter/foundation.dart';
import 'package:TraceFlow/models/receipt_stub.dart';

class ReceiptBook {
  final String bookID;
  final String number;
  final String status;
  final String qrCode;
  final String? currentHolderID;
  final String? agentID;
  final String typeID;
  final String? type; // Added
  final ReceiptStub? receiptStub;

  ReceiptBook({
    required this.bookID,
    required this.number,
    required this.status,
    required this.qrCode,
    this.currentHolderID,
    this.agentID,
    required this.typeID,
    this.type,
    this.receiptStub,
  });

  factory ReceiptBook.fromJson(Map<String, dynamic> json) {
    if (kDebugMode) {
      print('Parsing bookID: ${json['bookID']}');
      print('Parsing number: ${json['number']}');
      print('Parsing status: ${json['status']}');
      print('Parsing qrCode: ${json['qrCode']}');
      print('Parsing currentHolderID: ${json['currentHolderID']}');
      print('Parsing agentID: ${json['agentID']}');
      print('Parsing typeID: ${json['typeID']}');
      print('Parsing type: ${json['type']}');
      print('Parsing ReceiptStub: ${json['ReceiptStub']}');
    }

    return ReceiptBook(
      bookID: json['bookID'] as String,
      number: json['number'] as String,
      status: json['status'] as String,
      qrCode: 'data:image/png;base64,${json['qrCode'] as String}',
      currentHolderID: json['currentHolderID'] as String?,
      agentID: json['agentID'] as String?,
      typeID: json['typeID'] as String,
      type: json['type'] as String?,
      receiptStub: json['ReceiptStub'] != null
          ? ReceiptStub.fromJson(json['ReceiptStub'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'bookID': bookID,
      'number': number,
      'status': status,
      'qrCode': qrCode.startsWith('data:image/png;base64,')
          ? qrCode.substring('data:image/png;base64,'.length)
          : qrCode,
      'currentHolderID': currentHolderID,
      'agentID': agentID,
      'typeID': typeID,
      'type': type,
      'ReceiptStub': receiptStub?.toJson(),
    };
  }
}