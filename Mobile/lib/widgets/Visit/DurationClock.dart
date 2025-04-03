import 'package:flutter/material.dart';

import '../commen/spacer.dart';

class DurationClock extends StatelessWidget {
  final int duration;

  const DurationClock({required this.duration, super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.timer, size: 30),
        const CustomSpacer(height: 8),
        Text('$duration min', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
      ],
    );
  }
}