import 'package:flutter/material.dart';
import 'package:flutter/services.dart'; // Required for FilteringTextInputFormatter

class CustomTextField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData? prefixIcon;
  final IconData? suffixIcon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final VoidCallback? onSuffixPressed;
  final bool enabled;
  final int? maxLength;
  final void Function(String)? onChanged; // Added
  final List<TextInputFormatter>? inputFormatters; // Added
  final bool autofocus; // Added

  const CustomTextField({
    required this.controller,
    required this.label,
    this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.keyboardType,
    this.validator,
    this.onSuffixPressed,
    this.enabled = true,
    this.maxLength,
    this.onChanged, // Added
    this.inputFormatters, // Added
    this.autofocus = false, // Added, default to false
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: prefixIcon != null
            ? Icon(prefixIcon, color: theme.colorScheme.primary.withOpacity(0.8))
            : null,
        suffixIcon: suffixIcon != null
            ? IconButton(
          icon: Icon(suffixIcon, color: theme.colorScheme.primary.withOpacity(0.8)),
          onPressed: enabled ? onSuffixPressed : null,
        )
            : null,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: theme.colorScheme.primary, width: 1.5),
        ),
        filled: true,
        fillColor: theme.colorScheme.surface.withOpacity(0.9),
        contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
      ),
      obscureText: obscureText,
      keyboardType: keyboardType,
      validator: validator,
      style: theme.textTheme.bodyMedium,
      enabled: enabled,
      maxLength: maxLength,
      onChanged: onChanged, // Added
      inputFormatters: inputFormatters, // Added
      autofocus: autofocus, // Added
    );
  }
}