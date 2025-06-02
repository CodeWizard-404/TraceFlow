import 'package:flutter/material.dart';

import '../commen/spacer.dart';

class ChecklistRow extends StatelessWidget {
  final String item;
  final bool checked;

  const ChecklistRow({required this.item, required this.checked, super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            checked ? Icons.check_circle : Icons.circle_outlined,
            color: checked ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
            size: 20,
          ),
          const CustomSpacer(width: 12),
          Expanded(child: Text(item, style: Theme.of(context).textTheme.bodyMedium)),
        ],
      ),
    );
  }
}