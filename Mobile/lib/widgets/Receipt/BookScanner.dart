import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/receipt_book_provider.dart';
import 'package:TraceFlow/widgets/commen/button.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';

class BookScanner extends StatelessWidget {
  final List<String> selectedBookIDs;
  final String? error;
  final Future<void> Function() onScanQR;
  final void Function(String) onRemoveBook;

  const BookScanner({
    required this.selectedBookIDs,
    required this.error,
    required this.onScanQR,
    required this.onRemoveBook,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context);

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
        ...selectedBookIDs.map((bookID) {
          final book = receiptBookProvider.receiptBooks.firstWhere((b) => b.bookID == bookID);
          return ListTile(
            title: Text('Receipt #${book.number}'),
            subtitle: Text('Type: ${book.type} | Status: ${book.status}'),
            trailing: IconButton(
              icon: const Icon(Icons.remove_circle),
              onPressed: () => onRemoveBook(bookID),
            ),
          );
        }),
        if (error != null) ...[
          const CustomSpacer(height: 16),
          Text(error!, style: const TextStyle(color: Colors.red)),
        ],
      ],
    );
  }
}