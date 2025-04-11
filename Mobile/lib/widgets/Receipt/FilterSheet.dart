import 'package:flutter/material.dart';
import 'package:TraceFlow/widgets/commen/button.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';

class FilterSheet extends StatefulWidget {
  final Set<String> typeOptions;
  final Map<String, Set<String>> initialFilters;
  final Function(Map<String, Set<String>>) onApply;

  const FilterSheet({
    required this.typeOptions,
    required this.initialFilters,
    required this.onApply,
    super.key,
  });

  @override
  State<FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<FilterSheet> {
  late Map<String, Set<String>> _filters;

  @override
  @override
  void initState() {
    super.initState();
    _filters = Map.from(widget.initialFilters);
    _filters['status'] = Set.from(_filters['status'] ?? {'To Agent', 'To Manager'});
  }

  @override
  Widget build(BuildContext context) {
    final allStatusOptions = {'To Agent', 'To Manager'}; // Hardcode derived statuses
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
          const Text('Filter Receipt Books', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
      const CustomSpacer(height: 16),
      const Text('Destination', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
      Wrap(spacing: 8, children: _buildChips(allStatusOptions, 'status')),
      const CustomSpacer(height: 16),
      const Text('Type', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
      Wrap(spacing: 8, children: _buildChips(widget.typeOptions, 'type')),
      const CustomSpacer(height: 24),
      Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
          CustomButton(
          label: 'Clear',
          onPressed: () => setState(() => _filters..['status']!.clear()..['type']!.clear()),
      isOutlined: true,
    ),
    CustomButton(
    label: 'Apply',
    onPressed: () {
    widget.onApply(_filters);
    Navigator.pop(context);
    },
    ),
    ],
    ),
    ],
    ),
    );
  }

  List<Widget> _buildChips(Set<String> options, String key) {
    return options.map<Widget>((option) {
      final isSelected = _filters[key]!.contains(option);
      return FilterChip(
        label: Text(option),
        selected: isSelected,
        onSelected: (_) => setState(() => isSelected ? _filters[key]!.remove(option) : _filters[key]!.add(option)),
        selectedColor: Theme.of(context).colorScheme.primary.withOpacity(0.2),
        labelStyle: TextStyle(color: isSelected ? Theme.of(context).colorScheme.primary : null),
      );
    }).toList();
  }
}