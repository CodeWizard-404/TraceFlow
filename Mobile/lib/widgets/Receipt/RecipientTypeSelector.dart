import 'package:flutter/material.dart';
import 'package:TraceFlow/widgets/commen/dropdown.dar.dart';

class RecipientTypeSelector extends StatelessWidget {
  final String? recipientType;
  final void Function(String?) onChanged;

  const RecipientTypeSelector({
    required this.recipientType,
    required this.onChanged,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    const recipientOptions = ["Supervisor", "Regional Manager", "Agent", "Stock Manager", "Stub Collection"];
    return CustomDropdown<String>(
      value: recipientType,
      items: recipientOptions,
      hint: 'Select Recipient Type',
      onChanged: onChanged,
    );
  }
}