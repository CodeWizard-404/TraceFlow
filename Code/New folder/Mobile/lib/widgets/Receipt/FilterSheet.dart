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
  void initState() {
    super.initState();
    _filters = Map.from(widget.initialFilters);
    _filters['status'] = Set.from(_filters['status'] ?? {'To Agent', 'To Manager'});
  }

  Widget _buildSectionCard(BuildContext context, {required String title, required List<Widget> children}) {
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.primary,
              ),
            ),
          ),
          const Divider(height: 1, thickness: 1, color: Colors.grey),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final allStatusOptions = {'To Agent', 'To Manager'};
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: theme.colorScheme.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
        Text(
        'Filter Receipt Books',
        style: theme.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          color: theme.colorScheme.onSurface,
        ),
      ),
      const CustomSpacer(height: 16),
      _buildSectionCard(
        context,
        title: 'Destination',
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _buildChips(allStatusOptions, 'status'),
          ),
        ],
      ),
      const CustomSpacer(height: 8),
      _buildSectionCard(
        context,
        title: 'Type',
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _buildChips(widget.typeOptions, 'type'),
          ),
        ],
      ),
      const CustomSpacer(height: 16),
      Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
          CustomButton(
          label: 'Clear',
          onPressed: () => setState(() => _filters..['status']!.clear()..['type']!.clear()),
      isOutlined: true,
      backgroundColor: theme.colorScheme.surface,
      textColor: theme.colorScheme.onSurface,
    ),
    CustomButton(
    label: 'Apply',
    onPressed: () {
    widget.onApply(_filters);
    Navigator.pop(context);
    },
    backgroundColor: theme.colorScheme.primary.withOpacity(0.8),
    textColor: theme.colorScheme.primary,
    isOutlined: true,
    ),
    ],
    ),
    ],
    ),
    );
  }

  List<Widget> _buildChips(Set<String> options, String key) {
    final theme = Theme.of(context);
    return options.map<Widget>((option) {
      final isSelected = _filters[key]!.contains(option);
      return GestureDetector(
        onTap: () => setState(() {
          if (isSelected) {
            _filters[key]!.remove(option);
          } else {
            _filters[key]!.add(option);
          }
        }),
        child: Chip(
          label: Text(
            option,
            style: theme.textTheme.bodySmall?.copyWith(
              color: isSelected ? theme.colorScheme.primary : theme.colorScheme.onSurface,
            ),
          ),
          backgroundColor: isSelected
              ? theme.colorScheme.primary.withOpacity(0.2)
              : theme.colorScheme.background,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(
              color: isSelected
                  ? theme.colorScheme.primary
                  : theme.colorScheme.primary.withOpacity(0.7),
              width: 1,
            ),
          ),
        ),
      );
    }).toList();
  }
}