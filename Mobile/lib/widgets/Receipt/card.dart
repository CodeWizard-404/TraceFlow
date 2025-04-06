import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:TraceFlow/widgets/commen/card.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';

class ReceiptBookCard extends StatelessWidget {
  final dynamic book;

  const ReceiptBookCard({required this.book, super.key});

  String _getDisplayStatus() {

      String? stubStatus;
      if (book.receiptStub is Map) {
        stubStatus = book.receiptStub['status'] as String?;
      } else if (book.receiptStub != null) {
        stubStatus = book.receiptStub.status as String?;
      }
      if (stubStatus == "pending") return "To Agent";
      if (stubStatus == "collected") return "To Manager";

    return book.status ?? "Unknown"; // Fallback if status is null
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return CustomCard(
      title: '#${book.number ?? "N/A"}',
      child: Row(
        children: [
          SizedBox(
            width: 40,
            height: 40,
            child: Image.memory(
              base64Decode((book.qrCode ?? '').split(',').last),
              errorBuilder: (_, __, ___) => const Icon(Icons.error, size: 20),
            ),
          ),
          const CustomSpacer(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(book.type ?? "N/A", style: theme.textTheme.bodyMedium),
                Text(
                  _getDisplayStatus(),
                  style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}