
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/receipt_book.dart';
import '../../models/receipt_book_type.dart';
import '../../providers/receipt_book_provider.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/commen/button.dart';

class BookScanner extends StatelessWidget {
  final List<String> selectedBookIDs;
  final String? error;
  final String? recipientType;
  final VoidCallback onScanQR;
  final Function(String) onRemoveBook;

  const BookScanner({
    Key? key,
    required this.selectedBookIDs,
    this.error,
    required this.recipientType,
    required this.onScanQR,
    required this.onRemoveBook,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CustomButton(
          label: 'Scan Receipt Book',
          icon: Icons.qr_code_scanner,
          onPressed: onScanQR,
          backgroundColor: theme.colorScheme.primary.withOpacity(0.8),
          textColor: theme.colorScheme.primary,
          isOutlined: true,
        ),
        const CustomSpacer(height: 8),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              error!,
              style: TextStyle(
                color: theme.colorScheme.error,
                fontSize: 12,
              ),
            ),
          ),
        if (selectedBookIDs.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: selectedBookIDs.map((bookID) {
              final book = receiptBookProvider.receiptBooks.firstWhere(
                    (b) => b.bookID == bookID,
                orElse: () => ReceiptBook(
                  bookID: '',
                  number: 'Unknown',
                  status: '',
                  qrCode: '',
                  typeID: '',
                ),
              );
              final typeName = receiptBookProvider.receiptBookTypes
                  .firstWhere(
                    (t) => t.typeID == book.typeID,
                orElse: () => ReceiptBookType(typeID: '', name: 'Unknown'),
              )
                  .name;
              return Chip(
                label: Text(
                  '${book.number} ($typeName)',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                backgroundColor: theme.colorScheme.background,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(
                    color: theme.colorScheme.primary.withOpacity(0.7),
                    width: 1,
                  ),
                ),
                deleteIcon: Icon(
                  Icons.close,
                  size: 16,
                  color: theme.colorScheme.onSurface.withOpacity(0.6),
                ),
                onDeleted: () => onRemoveBook(bookID),
              );
            }).toList(),
          ),
      ],
    );
  }
}