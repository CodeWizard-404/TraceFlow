import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_interceptor/http_interceptor.dart';

import 'cookie_manager.dart';

class CookieInterceptor implements InterceptorContract {
  @override
  Future<BaseRequest> interceptRequest({required BaseRequest request}) async {
    request.headers.addAll(
        CookieManager.getHeaders({'Content-Type': 'application/json'}));
    if (kDebugMode) print('Sending cookies: ${request.headers['Cookie']}');
    return request;
  }

  @override
  Future<BaseResponse> interceptResponse(
      {required BaseResponse response}) async {
    if (response is http.Response || response is http.StreamedResponse) {
      final httpResponse = response is http.StreamedResponse
          ? http.Response(
          await response.stream.bytesToString(), response.statusCode,
          headers: response.headers)
          : response as http.Response;
      CookieManager.extractCookies(httpResponse);
    }
    return response;
  }

  @override
  Future<bool> shouldInterceptRequest() async => true;

  @override
  Future<bool> shouldInterceptResponse() async => true;

}

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