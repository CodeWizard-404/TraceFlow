import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

// Manages cookies for authentication (accessToken, refreshToken, deviceToken).
class CookieManager {
  // In-memory cookie storage
  static Map<String, String> cookies = {};
  // Secure storage for persisting cookies
  static const _storage = FlutterSecureStorage();

  // Saves cookies to memory and secure storage.
  static Future<void> saveCookies(Map<String, String> cookieMap) async {
    try {
      for (var entry in cookieMap.entries) {
        final key = entry.key;
        final value = entry.value;
        if (key == 'accessToken' || key == 'refreshToken' || key == 'deviceToken') {
          cookies[key] = value;
          await _storage.write(key: key, value: value);
          if (kDebugMode) print('Stored cookie: $key=$value');
        }
      }
      if (kDebugMode) print('Saved cookies: $cookies');
    } catch (e) {
      if (kDebugMode) print('Failed to save cookies: $e');
    }
  }

  // Extracts and stores cookies from HTTP response headers.
  static Future<void> extractCookies(http.Response response) async {
    final setCookie = response.headers['set-cookie'];
    if (setCookie == null) {
      if (kDebugMode) print('No set-cookie header found');
      return;
    }

    final cookieList = _splitCookies(setCookie);
    for (var cookie in cookieList) {
      final parts = cookie.split(';')[0].split('=');
      if (parts.length < 2) continue;

      final key = parts[0].trim();
      final value = parts[1].trim();
      if (key == 'accessToken' || key == 'refreshToken' || key == 'deviceToken') {
        cookies[key] = value;
        try {
          await _storage.write(key: key, value: value);
          if (kDebugMode) print('Stored cookie: $key=$value');
        } catch (e) {
          if (kDebugMode) print('Failed to store cookie $key: $e');
        }
      }
    }
    if (kDebugMode) print('Extracted cookies: $cookies');
  }

  // Loads cookies from secure storage into memory.
  static Future<void> loadCookies() async {
    try {
      final accessToken = await _storage.read(key: 'accessToken');
      final refreshToken = await _storage.read(key: 'refreshToken');
      final deviceToken = await _storage.read(key: 'deviceToken');
      cookies.clear();
      if (accessToken != null && accessToken.isNotEmpty) cookies['accessToken'] = accessToken;
      if (refreshToken != null && refreshToken.isNotEmpty) cookies['refreshToken'] = refreshToken;
      if (deviceToken != null && deviceToken.isNotEmpty) cookies['deviceToken'] = deviceToken;
      if (kDebugMode) print('Loaded cookies: $cookies');
    } catch (e) {
      if (kDebugMode) print('Failed to load cookies: $e');
      cookies.clear();
    }
  }

  // Splits set-cookie header into individual cookies, handling commas and quotes.
  static List<String> _splitCookies(String setCookie) {
    final cookies = <String>[];
    var currentCookie = '';
    var inQuotes = false;
    for (var i = 0; i < setCookie.length; i++) {
      final char = setCookie[i];
      if (char == '"') {
        inQuotes = !inQuotes;
      } else if (char == ',' && !inQuotes) {
        cookies.add(currentCookie.trim());
        currentCookie = '';
        continue;
      }
      currentCookie += char;
    }
    if (currentCookie.isNotEmpty) cookies.add(currentCookie.trim());
    return cookies;
  }

  // Generates HTTP headers with cookies.
  static Map<String, String> getHeaders([Map<String, String>? additionalHeaders]) {
    final headers = additionalHeaders != null ? Map<String, String>.from(additionalHeaders) : <String, String>{};
    if (cookies.isNotEmpty) {
      headers['Cookie'] = cookies.entries
          .where((e) => e.key == 'accessToken' || e.key == 'refreshToken' || e.key == 'deviceToken')
          .map((e) => '${e.key}=${e.value}')
          .join('; ');
      if (kDebugMode) print('Sending Cookie header: ${headers['Cookie']}');
    } else {
      if (kDebugMode) print('No cookies to send');
    }
    return headers;
  }

  // Clears cookies from memory and storage, preserving deviceToken if present.
  static Future<void> clearCookies({String? caller}) async {
    if (kDebugMode) print('Clearing cookies, called by: ${caller ?? "unknown"}');
    final deviceToken = cookies['deviceToken'];
    cookies.clear();
    try {
      await _storage.delete(key: 'accessToken');
      await _storage.delete(key: 'refreshToken');
      if (deviceToken != null) {
        cookies['deviceToken'] = deviceToken;
        await _storage.write(key: 'deviceToken', value: deviceToken);
      }
      if (kDebugMode) print('Cleared cookies, preserved deviceToken: $deviceToken');
    } catch (e) {
      if (kDebugMode) print('Failed to clear cookies: $e');
    }
  }
}