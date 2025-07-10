// lib/widgets/commen/custom_formatter.dart
import 'package:flutter/services.dart';

class CustomFormatter extends TextInputFormatter {
  final String Function(String) format;
  final int? maxLength; // Add maxLength parameter

  CustomFormatter(this.format, {this.maxLength});

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    // If deleting, allow it without reformatting
    if (newValue.text.length < oldValue.text.length) {
      return newValue;
    }

    // Extract digits only
    String digitsOnly = newValue.text.replaceAll(RegExp(r'[^\d]'), '');

    // Enforce maxLength on raw digits, if provided
    if (maxLength != null && digitsOnly.length > maxLength!) {
      digitsOnly = digitsOnly.substring(0, maxLength);
    }

    // Apply formatting
    final formattedText = format(digitsOnly);

    // Adjust cursor position
    final newCursorOffset = newValue.selection.baseOffset >= 0
        ? (newValue.selection.baseOffset * formattedText.length / newValue.text.length).round()
        : formattedText.length;

    return TextEditingValue(
      text: formattedText,
      selection: TextSelection.collapsed(offset: newCursorOffset.clamp(0, formattedText.length)),
    );
  }
}