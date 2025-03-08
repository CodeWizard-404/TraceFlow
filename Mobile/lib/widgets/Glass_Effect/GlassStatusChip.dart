import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class GlassStatusChip extends StatelessWidget {
  final String status;
  final Color? color;

  const GlassStatusChip({required this.status, this.color, super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: [
            (color ?? Colors.grey).withOpacity(0.2),
            (color ?? Colors.grey).withOpacity(0.1),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: (color ?? Colors.grey).withOpacity(0.2),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        status,
        style: TextStyle(
          fontSize: 12,
          color: color ?? Colors.grey,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}