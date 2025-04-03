import 'package:flutter/material.dart';

class AppThemes {
  static final lightTheme = ThemeData(
    brightness: Brightness.light,
    primaryColor: const Color(0xFF4CB1C7), // Only for explicit pops
    scaffoldBackgroundColor: Colors.white,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      elevation: 0,
      iconTheme: IconThemeData(color: Color(0xFF1F2937)), // Black-ish
      titleTextStyle: TextStyle(
        color: Color(0xFF1F2937), // Black-ish
        fontSize: 20,
        fontWeight: FontWeight.w600,
        fontFamily: 'Inter',
      ),
    ),
    cardTheme: CardTheme(
      elevation: 5,
      color: const Color(0xFFF9FAFB), // Light gray-white
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: const BorderSide(color: Color(0xFF4CB1C7), width: 1), // Gray border
      ),
      margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
    ),
    textTheme: const TextTheme(
      headlineSmall: TextStyle(
        color: Color(0xFF1F2937), // Black-ish
        fontSize: 18,
        fontWeight: FontWeight.w600,
        fontFamily: 'Inter',
      ),
      bodyMedium: TextStyle(
        color: Color(0xFF6B7280), // Mid gray
        fontSize: 14,
        fontWeight: FontWeight.w400,
        fontFamily: 'Inter',
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF4CB1C7), // Blue only here
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        elevation: 0,
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, fontFamily: 'Inter'),
      ),
    ),
    colorScheme: const ColorScheme.light(
      primary: Color(0xFF4CB1C7), // Blue only for buttons
      secondary: Color(0xFF6B7280), // Gray
      surface: Color(0xFFE9F7FF), // Card color
      onSurface: Color(0xFF1F2937), // Black-ish
      background: Colors.white,
    ),
    dividerColor: const Color(0xFFE5E7EB), // Light gray
    iconTheme: const IconThemeData(color: Color(0xFF6B7280), size: 20), // Mid gray
    splashFactory: InkRipple.splashFactory,
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: ZoomPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
    visualDensity: VisualDensity.adaptivePlatformDensity,
  );

  static final darkTheme = ThemeData(
    brightness: Brightness.dark,
    primaryColor: const Color(0xFF63B3ED), // Only for explicit pops
    scaffoldBackgroundColor: const Color(0xFF0E1113),
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFF0E1113),
      elevation: 0,
      iconTheme: IconThemeData(color: Color(0xFFD1D5DB)), // Light gray
      titleTextStyle: TextStyle(
        color: Color(0xFFD1D5DB), // Light gray
        fontSize: 20,
        fontWeight: FontWeight.w600,
        fontFamily: 'Inter',
      ),
    ),
    cardTheme: CardTheme(
      elevation: 5,
      color: const Color(0xff282a2c), // Dark slate
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: const BorderSide(color: Color(0xFF63B3ED), width: 1), // Dark gray border
      ),
      margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
    ),
    textTheme: const TextTheme(
      headlineSmall: TextStyle(
        color: Color(0xFFD1D5DB), // Light gray
        fontSize: 18,
        fontWeight: FontWeight.w600,
        fontFamily: 'Inter',
      ),
      bodyMedium: TextStyle(
        color: Color(0xFF9CA3AF), // Mid gray
        fontSize: 14,
        fontWeight: FontWeight.w400,
        fontFamily: 'Inter',
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF63B3ED), // Blue only here
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        elevation: 0,
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, fontFamily: 'Inter'),
      ),
    ),
    colorScheme: const ColorScheme.dark(
      primary: Color(0xFF63B3ED), // Blue only for buttons
      secondary: Color(0xFF9CA3AF), // Gray
      surface: Color(0xFF212123), // Card color
      onSurface: Color(0xFFD1D5DB), // Light gray
      background: Color(0xFF1e1f22),
    ),
    dividerColor: const Color(0xFF1e1f22), // Dark gray
    iconTheme: const IconThemeData(color: Color(0xFF9CA3AF), size: 20), // Mid gray
    splashFactory: InkRipple.splashFactory,
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: ZoomPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
    visualDensity: VisualDensity.adaptivePlatformDensity,
  );
}