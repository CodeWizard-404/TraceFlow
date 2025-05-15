import 'package:flutter/material.dart';
import 'package:TraceFlow/screens/Receipt/transfer_receipt_book.dart';
import 'package:TraceFlow/widgets/commen/button.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';
import 'package:TraceFlow/widgets/commen/text_field.dart';
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
    final sortKey = GlobalKey();
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: Column(
        children: [
          SizedBox(
            height: 50,
            child: CustomTextField(controller: searchController, label: 'Search Number/Type'),
          ),
          const CustomSpacer(height: 8),
          Row(
            children: [
              IconButton(
                key: sortKey,
                icon: const Icon(Icons.sort_rounded),
                onPressed: () => onSort(sortKey),
                tooltip: 'Sort',
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.filter_alt_rounded),
                onPressed: () => showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
                  builder: (_) => FilterSheet(
                    typeOptions: typeOptions,
                    initialFilters: initialFilters,
                    onApply: onApplyFilters,
                  ),
                ),
                tooltip: 'Filter',
              ),
              const Spacer(),
              CustomButton(
                label: 'Transfer',
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TransferReceiptBookScreen())),
              ),
            ],
          ),
        ],
      ),
    );
  }
}