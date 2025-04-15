import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import './cookie_manager.dart';

class CustomHttpClient {
  static final http.Client _client = http.Client();

  static Future<http.Response> get(Uri url, {Map<String, String>? headers}) async {
    if (kDebugMode) print('CustomHttpClient GET $url');
    final mergedHeaders = CookieManager.getHeaders(headers);
    final response = await _client.get(url, headers: mergedHeaders);
    if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
    CookieManager.extractCookies(response);
    return response;
  }

  static Future<http.Response> post(
      Uri url, {
      Map<String, String>? headers,
      Object? body,
      Encoding? encoding,
    }) async {
    if (kDebugMode) print('CustomHttpClient POST $url');
    final mergedHeaders = CookieManager.getHeaders(headers);
    final response = await _client.post(url, headers: mergedHeaders, body: body, encoding: encoding);
    if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
    CookieManager.extractCookies(response);
    return response;
  }

  static Future<http.Response> put(
      Uri url, {
      Map<String, String>? headers,
      Object? body,
      Encoding? encoding,
    }) async {
    if (kDebugMode) print('CustomHttpClient PUT $url');
    final mergedHeaders = CookieManager.getHeaders(headers);
    final response = await _client.put(url, headers: mergedHeaders, body: body, encoding: encoding);
    if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
    CookieManager.extractCookies(response);
    return response;
  }

  static Future<http.Response> delete(
      Uri url, {
      Map<String, String>? headers,
      Object? body,
      Encoding? encoding,
    }) async {
    if (kDebugMode) print('CustomHttpClient DELETE $url');
    final mergedHeaders = CookieManager.getHeaders(headers);
    final response = await _client.delete(url, headers: mergedHeaders, body: body, encoding: encoding);
    if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
    CookieManager.extractCookies(response);
    return response;
  }
}