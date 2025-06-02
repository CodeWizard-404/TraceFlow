import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart';
import 'package:http/http.dart' as http;
import 'package:http_interceptor/http_interceptor.dart';
import 'auth_service.dart';
import 'cookie_manager.dart';

class CookieInterceptor implements InterceptorContract {
  bool _isRetrying = false;
  int _retryCount = 0;
  static const int maxRetries = 2;

  @override
  Future<BaseRequest> interceptRequest({required BaseRequest request}) async {
    final headers = CookieManager.getHeaders();
    request.headers.addAll(headers);
    if (request is Request || request is MultipartRequest) {
      request.followRedirects = true;
      request.persistentConnection = true;
    }
    if (kDebugMode) {
      print('Intercepting request: ${request.url}, headers: ${request.headers}');
    }
    return request;
  }

  @override
  Future<BaseResponse> interceptResponse({required BaseResponse response}) async {
    http.Response httpResponse = await _normalizeResponse(response);
    CookieManager.extractCookies(httpResponse);

    if (httpResponse.statusCode == 401 && !_isRetrying && _retryCount < maxRetries) {
      _isRetrying = true;
      _retryCount++;
      try {
        if (kDebugMode) print('401 detected: Attempting token refresh');
        final refreshResult = await AuthService.refreshToken(CookieManager.cookies['refreshToken'] ?? '');
        if (kDebugMode) print('Token refresh result: $refreshResult');

        final request = httpResponse.request!;
        final retryRequest = _copyRequest(request);
        retryRequest.headers.addAll(CookieManager.getHeaders());

        final client = http.Client();
        try {
          final retryResponse = await client.send(retryRequest);
          final responseBody = await retryResponse.stream.bytesToString();
          final newResponse = http.Response(
            responseBody,
            retryResponse.statusCode,
            headers: retryResponse.headers,
            request: retryResponse.request,
            persistentConnection: retryResponse.persistentConnection,
            reasonPhrase: retryResponse.reasonPhrase,
          );
          CookieManager.extractCookies(newResponse);
          if (kDebugMode) print('Retry response: ${newResponse.statusCode}');
          return newResponse;
        } finally {
          client.close();
        }
      } catch (e) {
        if (kDebugMode) print('Token refresh failed: $e');
        if (e.toString().contains('Invalid refresh token') || e.toString().contains('401')) {
          await CookieManager.clearCookies();
        }
        return httpResponse;
      } finally {
        _isRetrying = false;
      }
    }
    _retryCount = 0;
    return httpResponse;
  }

  Future<http.Response> _normalizeResponse(BaseResponse response) async {
    if (response is http.StreamedResponse) {
      return http.Response(
        await response.stream.bytesToString(),
        response.statusCode,
        headers: response.headers,
        request: response.request,
        persistentConnection: response.persistentConnection,
        reasonPhrase: response.reasonPhrase,
      );
    }
    return response as http.Response;
  }

  http.BaseRequest _copyRequest(http.BaseRequest original) {
    if (original is http.MultipartRequest) {
      final request = http.MultipartRequest(original.method, original.url)
        ..headers.addAll(original.headers)
        ..fields.addAll(original.fields)
        ..files.addAll(original.files)
        ..followRedirects = original.followRedirects
        ..maxRedirects = original.maxRedirects
        ..persistentConnection = original.persistentConnection;
      return request;
    }
    final request = http.Request(original.method, original.url)
      ..headers.addAll(original.headers)
      ..followRedirects = original.followRedirects
      ..maxRedirects = original.maxRedirects
      ..persistentConnection = original.persistentConnection;
    if (original is http.Request) {
      request.body = original.body;
      request.encoding = original.encoding;
    }
    return request;
  }

  @override
  Future<bool> shouldInterceptRequest() async => true;

  @override
  Future<bool> shouldInterceptResponse() async => true;
}

class CustomHttpClient {
  static final InterceptedClient _client = InterceptedClient.build(
    interceptors: [CookieInterceptor()],
    client: http.Client(),
    requestTimeout: Duration(seconds: 30),
  );

  static Future<http.Response> get(Uri url, {Map<String, String>? headers}) async {
    final updatedHeaders = {...?headers, 'Content-Type': 'application/json'};
    if (kDebugMode) print('GET $url');
    final response = await _client.get(
      url,
      headers: updatedHeaders,
      // Ensure cookies are sent
      // Note: withCredentials is not directly supported in Dart's http package,
      // but cookies are automatically included if properly stored in CookieManager
    );
    if (kDebugMode) print('GET response: ${response.statusCode}');
    return response;
  }

  static Future<http.Response> post(
      Uri url, {
        Map<String, String>? headers,
        Object? body,
        Encoding? encoding,
      }) async {
    final updatedHeaders = headers != null ? Map<String, String>.from(headers) : <String, String>{};
    if (body != null && !updatedHeaders.containsKey('Content-Type')) {
      updatedHeaders['Content-Type'] = 'application/json';
    }
    if (kDebugMode) print('POST $url');
    final response = await _client.post(
      url,
      headers: updatedHeaders,
      body: body,
      encoding: encoding,
    );
    if (kDebugMode) print('POST response: ${response.statusCode}');
    return response;
  }

  static Future<http.Response> put(
      Uri url, {
        Map<String, String>? headers,
        Object? body,
        Encoding? encoding,
      }) async {
    final updatedHeaders = {...?headers, 'Content-Type': 'application/json'};
    if (kDebugMode) print('PUT $url');
    final response = await _client.put(
      url,
      headers: updatedHeaders,
      body: body,
      encoding: encoding,
    );
    if (kDebugMode) print('PUT response: ${response.statusCode}');
    return response;
  }

  static Future<http.Response> delete(
      Uri url, {
        Map<String, String>? headers,
        Object? body,
        Encoding? encoding,
      }) async {
    final updatedHeaders = {...?headers, 'Content-Type': 'application/json'};
    if (kDebugMode) print('DELETE $url');
    final response = await _client.delete(
      url,
      headers: updatedHeaders,
      body: body,
      encoding: encoding,
    );
    if (kDebugMode) print('DELETE response: ${response.statusCode}');
    return response;
  }
}