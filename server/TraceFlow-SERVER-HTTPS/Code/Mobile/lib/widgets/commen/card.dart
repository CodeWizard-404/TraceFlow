import 'package:flutter/material.dart';

class CustomCard extends StatelessWidget {
  final String title;
  final Widget child;

  const CustomCard({
    required this.title,
    required this.child,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: theme.textTheme.headlineSmall?.copyWith(color: theme.colorScheme.primary)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}