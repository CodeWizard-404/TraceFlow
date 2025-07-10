import 'package:flutter/material.dart';
import 'package:TraceFlow/screens/Receipt/transfer_receipt_book.dart';
import 'package:TraceFlow/widgets/commen/button.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';
import 'FilterSheet.dart';

class FilterSortHeader extends StatelessWidget {
  final TextEditingController searchController;
  final void Function(GlobalKey) onSort;
  final VoidCallback onFilter;
  final Set<String> typeOptions;
  final Map<String, Set<String>> initialFilters;
  final Function(Map<String, Set<String>>) onApplyFilters;

  const FilterSortHeader({
    required this.searchController,
    required this.onSort,
    required this.onFilter,
    required this.typeOptions,
    required this.initialFilters,
    required this.onApplyFilters,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sortKey = GlobalKey();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: searchController,
          decoration: InputDecoration(
            filled: true,
            fillColor: theme.colorScheme.background,
            hintText: 'Search Number/Type',
            prefixIcon: Icon(
              Icons.search,
              color: theme.colorScheme.primary,
              size: 18,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(
                color: theme.colorScheme.primary,
                width: 1.5,
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(
                color: theme.colorScheme.primary.withOpacity(0.7),
                width: 1.5,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(
                color: theme.colorScheme.primary,
                width: 2,
              ),
            ),
            hintStyle: TextStyle(
              color: theme.colorScheme.onSurface.withOpacity(0.6),
            ),
          ),
          style: TextStyle(
            fontSize: 16,
            color: theme.colorScheme.onSurface,
          ),
        ),
        const CustomSpacer(height: 8),
        Row(
          children: [
            IconButton(
              key: sortKey,
              icon: Icon(
                Icons.sort_rounded,
                color: theme.colorScheme.primary,
              ),
              onPressed: () => onSort(sortKey),
              tooltip: 'Sort',
              style: IconButton.styleFrom(
                backgroundColor: theme.colorScheme.background,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: Icon(
                Icons.filter_alt_rounded,
                color: theme.colorScheme.primary,
              ),
              onPressed: () => showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                ),
                builder: (_) => FilterSheet(
                  typeOptions: typeOptions,
                  initialFilters: initialFilters,
                  onApply: onApplyFilters,
                ),
              ),
              tooltip: 'Filter',
              style: IconButton.styleFrom(
                backgroundColor: theme.colorScheme.background,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
            const Spacer(),
            CustomButton(
              label: 'Transfer',
              icon: Icons.send,
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const TransferReceiptBookScreen()),
              ),
              backgroundColor: theme.colorScheme.primary.withOpacity(0.8),
              textColor: theme.colorScheme.primary,
              isOutlined: true,
            ),
          ],
        ),
      ],
    );
  }
}