import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/receipt_book_provider.dart';
import 'package:TraceFlow/widgets/commen/button.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';

import '../../models/receipt_book_type.dart';

class BookScanner extends StatelessWidget {
  final List<String> selectedBookIDs;
  final String? error;
  final String? recipientType;
  final Future<void> Function() onScanQR;
  final void Function(String) onRemoveBook;

  const BookScanner({
    required this.selectedBookIDs,
    required this.error,
    this.recipientType,
    required this.onScanQR,
    required this.onRemoveBook,
    super.key,
  });

  String _getTypeName(String typeID, ReceiptBookProvider provider) {
    return provider.receiptBookTypes
        .firstWhere((t) => t.typeID == typeID, orElse: () => ReceiptBookType(typeID: '', name: 'Unknown Type'))
        .name;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Consumer<ReceiptBookProvider>(
      builder: (context, receiptBookProvider, child) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CustomButton(
              label: 'Scan QR Code',
              icon: Icons.qr_code_scanner,
              onPressed: onScanQR,
            ),
            const CustomSpacer(height: 16),
            Text('Selected Books (${selectedBookIDs.length}):', style: theme.textTheme.titleMedium),
            if (recipientType == "Stub Collection" && selectedBookIDs.isNotEmpty) ...[
              if (receiptBookProvider.currentReceiptBook != null)
                ListTile(
                  title: Text('Receipt #${receiptBookProvider.currentReceiptBook!.number}'),
                  subtitle: Text(
                      'Type: ${_getTypeName(receiptBookProvider.currentReceiptBook!.typeID, receiptBookProvider)} | Status: ${receiptBookProvider.currentReceiptBook!.status}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.remove_circle),
                    onPressed: () => onRemoveBook(selectedBookIDs.first),
                  ),
                )
              else
                const Text('Loading book details...', style: TextStyle(color: Colors.grey)),
            ] else ...[
              ...selectedBookIDs.map((bookID) {
                final book = receiptBookProvider.receiptBooks.firstWhere((b) => b.bookID == bookID);
                return ListTile(
                  title: Text('Receipt #${book.number}'),
                  subtitle: Text('Type: ${_getTypeName(book.typeID, receiptBookProvider)} | Status: ${book.status}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.remove_circle),
                    onPressed: () => onRemoveBook(bookID),
                  ),
                );
              }),
            ],
            if (error != null) ...[
              const CustomSpacer(height: 16),
              Text(error!, style: const TextStyle(color: Colors.red)),
            ],
          ],
        );
      },
    );
  }
}
