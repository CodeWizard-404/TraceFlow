import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class CookieManager {
  static Map<String, String> cookies = {};
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
  static const _storageKey = 'traceflow_auth_tokens';

  static Future<void> saveCookies(Map<String, String> cookieMap) async {
    try {
      cookies.addAll(cookieMap);
      final jsonCookies = jsonEncode(cookies);
      await _storage.write(key: _storageKey, value: jsonCookies);
      if (kDebugMode) print('Cookies saved: ${cookieMap.keys.join(', ')}');
    } catch (e) {
      if (kDebugMode) print('Failed to save cookies: $e');
      rethrow;
    }
  }

  static Future<void> extractCookies(http.Response response) async {
    final setCookie = response.headers['set-cookie'];
    if (setCookie == null) return;

    final cookieList = setCookie.split(RegExp(r',(?=\s*\w+=)')).map((c) => c.trim()).toList();
    Map<String, String> newCookies = {};
    for (var cookie in cookieList) {
      final parts = cookie.split(';')[0].split('=');
      if (parts.length < 2) continue;
      final key = parts[0].trim();
      final value = parts[1].trim();
      if (['accessToken', 'refreshToken', 'userData'].contains(key)) {
        newCookies[key] = value;
      }
    }
    if (newCookies.isNotEmpty) {
      await saveCookies(newCookies);
      if (kDebugMode) print('Cookies extracted: ${newCookies.keys.join(', ')}');
    }
  }

  static Future<void> loadCookies() async {
    try {
      final jsonCookies = await _storage.read(key: _storageKey);
      if (jsonCookies != null) {
        final loadedCookies = jsonDecode(jsonCookies) as Map<String, dynamic>;
        cookies.clear();
        cookies.addAll(loadedCookies.cast<String, String>());
        if (kDebugMode) print('Cookies loaded: ${cookies.keys.join(', ')}');
      } else {
        cookies.clear();
      }
    } catch (e) {
      if (kDebugMode) print('Failed to load cookies: $e');
      cookies.clear();
    }
  }

  static Map<String, String> getHeaders([Map<String, String>? additionalHeaders]) {
    final headers = additionalHeaders != null
        ? Map<String, String>.from(additionalHeaders)
        : <String, String>{};
    if (cookies.isNotEmpty) {
      headers['Cookie'] = cookies.entries.map((e) => '${e.key}=${e.value}').join('; ');
    }
    return headers;
  }

  static Future<Map<String, dynamic>?> getUserData() async {
    try {
      final userData = cookies['userData'];
      if (userData != null) {
        return jsonDecode(userData);
      }
      return null;
    } catch (e) {
      if (kDebugMode) print('Failed to get user data: $e');
      return null;
    }
  }

  static Future<void> clearCookies() async {
    try {
      cookies.clear();
      await _storage.delete(key: _storageKey);
      if (kDebugMode) print('Cookies cleared');
    } catch (e) {
      if (kDebugMode) print('Failed to clear cookies: $e');
    }
  }
}