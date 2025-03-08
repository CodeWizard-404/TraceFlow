import 'package:flutter/cupertino.dart';

class GlassChip extends StatelessWidget {
  final String label;

  const GlassChip({required this.label, super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: [
            Color(0xFF4CB1C7).withOpacity(0.2),
            Color(0xFF64C9D1).withOpacity(0.2),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0xFF4CB1C7).withOpacity(0.1),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          color: Color(0xFF4CB1C7),
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}