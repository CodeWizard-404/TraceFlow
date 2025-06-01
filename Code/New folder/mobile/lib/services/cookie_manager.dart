import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class CookieManager {
  static Map<String, String> cookies = {};
  static const _storage = FlutterSecureStorage();

  static Future<void> saveCookies(Map<String, String> cookieMap) async {
    try {
      for (var entry in cookieMap.entries) {
        cookies[entry.key] = entry.value;
        await _storage.write(key: entry.key, value: entry.value);
      }
      if (kDebugMode) print('Cookies saved: ${cookieMap.keys.join(', ')}');
    } catch (e) {
      if (kDebugMode) print('Failed to save cookies: $e');
    }
  }

  static Future<void> extractCookies(http.Response response) async {
    final setCookie = response.headers['set-cookie'];
    if (setCookie == null) return;

    final cookieList = setCookie.split(RegExp(r',(?=\s*\w+=)')).map((c) => c.trim()).toList();
    for (var cookie in cookieList) {
      final parts = cookie.split(';')[0].split('=');
      if (parts.length < 2) continue;
      final key = parts[0].trim();
      final value = parts[1].trim();
      if (['accessToken', 'refreshToken', 'userData'].contains(key)) {
        cookies[key] = value;
        await _storage.write(key: key, value: value);
      }
    }
    if (kDebugMode && cookieList.isNotEmpty) {
      print('Cookies extracted: ${cookieList.join(', ')}');
    }
  }

  static Future<void> loadCookies() async {
    try {
      final accessToken = await _storage.read(key: 'accessToken');
      final refreshToken = await _storage.read(key: 'refreshToken');
      final userData = await _storage.read(key: 'userData');
      cookies.clear();
      if (accessToken != null) cookies['accessToken'] = accessToken;
      if (refreshToken != null) cookies['refreshToken'] = refreshToken;
      if (userData != null) cookies['userData'] = userData;
      if (kDebugMode) print('Cookies loaded: ${cookies.keys.join(', ')}');
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
    final userData = await _storage.read(key: 'userData');
    if (userData != null) {
      try {
        return jsonDecode(userData);
      } catch (e) {
        if (kDebugMode) print('Invalid userData: $e');
      }
    }
    return null;
  }

  static Future<void> clearCookies() async {
    cookies.clear();
    await _storage.deleteAll();
    if (kDebugMode) print('Cookies cleared');
  }
}