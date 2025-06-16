import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';

class ReceiptBookCard extends StatelessWidget {
  final dynamic book;
  final int index;

  const ReceiptBookCard({required this.book, required this.index, super.key});

  String _getDisplayStatus() {
    String? stubStatus;
    if (book.receiptStub is Map) {
      stubStatus = (book.receiptStub['status'] as String?)?.toLowerCase();
    } else if (book.receiptStub != null) {
      stubStatus = (book.receiptStub.status as String?)?.toLowerCase();
    }
    if (stubStatus == "pending") return "To Agent";
    if (stubStatus == "collected") return "To Manager";
    return book.status ?? "Unknown";
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: theme.colorScheme.primary.withOpacity(0.7),
          width: 1.5,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            SizedBox(
              width: 40,
              height: 40,
              child: Image.memory(
                base64Decode((book.qrCode ?? '').split(',').last),
                errorBuilder: (_, __, ___) => Icon(
                  Icons.error,
                  size: 20,
                  color: theme.colorScheme.error,
                ),
              ),
            ),
            const CustomSpacer(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '#${book.number ?? "N/A"}',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: theme.colorScheme.onSurface,
                    ),
                  ),
                  Text(
                    book.type ?? "N/A",
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withOpacity(0.7),
                    ),
                  ),
                  Text(
                    _getDisplayStatus(),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withOpacity(0.6),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}