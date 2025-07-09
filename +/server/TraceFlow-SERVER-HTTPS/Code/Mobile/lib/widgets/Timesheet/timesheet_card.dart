import 'package:flutter/material.dart';
import '../commen/button.dart';
import '../commen/spacer.dart';

class TimesheetCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  const TimesheetCard({
    required this.title,
    required this.subtitle,
    this.onTap,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      child: Card(
        elevation: 7,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: theme.colorScheme.surface, width: 1),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: theme.textTheme.headlineSmall?.copyWith(color: theme.colorScheme.primary)),
              const CustomSpacer(height: 12),
              Text(subtitle, style: theme.textTheme.bodyMedium),
              if (onTap != null) ...[
                const CustomSpacer(height: 16),
                Align(
                  alignment: Alignment.centerRight,
                  child: CustomButton(
                    label: 'View',
                    onPressed: onTap!,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}