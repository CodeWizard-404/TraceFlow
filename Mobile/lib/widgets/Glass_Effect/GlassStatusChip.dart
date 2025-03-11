import 'package:flutter/material.dart';

class GlassStatusChip extends StatelessWidget {
  final String status;
  final Color? color;

  const GlassStatusChip({required this.status, this.color, super.key});

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? Theme.of(context).colorScheme.onSurface.withOpacity(0.6); // Fallback to onSurface

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: [
            chipColor.withOpacity(0.2),
            chipColor.withOpacity(0.1),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: chipColor.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        status,
        style: TextStyle(
          fontSize: 12,
          color: chipColor, // Use the provided or fallback color
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}