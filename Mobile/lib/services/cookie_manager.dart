import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class CookieManager {
  static Map<String, String> cookies = {};
  static const _storage = FlutterSecureStorage();

  static Future<void> extractCookies(http.Response response) async {
    final setCookie = response.headers['set-cookie'];
    if (setCookie != null) {
      final cookieList = _splitCookies(setCookie);
      for (var cookie in cookieList) {
        final parts = cookie.split(';')[0].split('=');
        if (parts.length >= 2) {
          final key = parts[0].trim();
          final value = parts[1].trim();
          if (key == 'accessToken' || key == 'refreshToken') {
            cookies[key] = value;
            await _storage.write(key: key, value: value);
            if (kDebugMode) print('Stored cookie: $key=$value');
          }
        }
      }
    }
    if (kDebugMode) print('After extractCookies, cookies: $cookies');
  }

  static Future<void> loadCookies() async {
    try {
      final accessToken = await _storage.read(key: 'accessToken');
      final refreshToken = await _storage.read(key: 'refreshToken');
      if (accessToken != null && accessToken.isNotEmpty) {
        cookies['accessToken'] = accessToken;
      }
      if (refreshToken != null && refreshToken.isNotEmpty) {
        cookies['refreshToken'] = refreshToken;
      }
      if (kDebugMode) print('Loaded cookies: $cookies');
    } catch (e) {
      if (kDebugMode) print('Failed to load cookies: $e');
    }
  }

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
    if (currentCookie.isNotEmpty) {
      cookies.add(currentCookie.trim());
    }
    return cookies;
  }

  static Map<String, String> getHeaders([Map<String, String>? additionalHeaders]) {
    final headers = additionalHeaders != null ? Map<String, String>.from(additionalHeaders) : <String, String>{};
    if (cookies.containsKey('accessToken')) {
      headers['Cookie'] = cookies.entries
          .where((e) => e.key == 'accessToken' || e.key == 'refreshToken')
          .map((e) => '${e.key}=${e.value}')
          .join('; ');
      if (kDebugMode) print('Sending Cookie header: ${headers['Cookie']}');
    } else {
      if (kDebugMode) print('No accessToken cookie to send, cookies: $cookies');
    }
    return headers;
  }

  static Future<void> clearCookies({String? caller}) async {
    if (kDebugMode) print('Clearing cookies, called by: ${caller ?? "unknown"}');
    cookies.clear();
    try {
      await _storage.delete(key: 'accessToken');
      await _storage.delete(key: 'refreshToken');
      if (kDebugMode) print('Cleared stored cookies');
    } catch (e) {
      if (kDebugMode) print('Failed to clear stored cookies: $e');
    }
    if (kDebugMode) print('After clearCookies, cookies: $cookies');
  }
}