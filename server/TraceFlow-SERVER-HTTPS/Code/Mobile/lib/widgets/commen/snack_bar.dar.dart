import 'package:flutter/material.dart';

class CustomSnackBar extends SnackBar {
  CustomSnackBar({super.key,
    required String message,
    Color super.backgroundColor = Colors.red,
    super.duration = const Duration(seconds: 3),
  }) : super(
    content: Text(message),
  );

  static void show({
    required BuildContext context,
    required String message,
    Color backgroundColor = Colors.red,
  }) {
    ScaffoldMessenger.of(context).removeCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      CustomSnackBar(message: message, backgroundColor: backgroundColor),
    );
  }
}