import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http_interceptor/http_interceptor.dart';
import 'package:http/http.dart' as http;
import 'cookie_manager.dart';
import 'auth_service.dart';

class CookieInterceptor implements InterceptorContract {
  bool _isRetrying = false;

  @override
  Future<BaseRequest> interceptRequest({required BaseRequest request}) async {
    request.headers.addAll(
      CookieManager.getHeaders({'Content-Type': 'application/json'}),
    );
    if (kDebugMode) print('Sending cookies: ${request.headers['Cookie']}');
    return request;
  }

  @override
  Future<BaseResponse> interceptResponse({required BaseResponse response}) async {
    if (response is http.Response || response is http.StreamedResponse) {
      final httpResponse = response is http.StreamedResponse
          ? http.Response(
        await response.stream.bytesToString(),
        response.statusCode,
        headers: response.headers,
        request: response.request,
        persistentConnection: response.persistentConnection,
        reasonPhrase: response.reasonPhrase,
      )
          : response as http.Response;

      CookieManager.extractCookies(httpResponse);

      // Handle 401 errors
      if (httpResponse.statusCode == 401 && !_isRetrying) {
        _isRetrying = true;
        try {
          if (kDebugMode) print('Received 401, attempting to refresh token');
          final refreshResult = await AuthService.refreshToken();
          if (kDebugMode) print('Refresh result: $refreshResult');

          // Retry the original request with updated cookies
          final request = httpResponse.request!;
          final retryRequest = _cloneRequest(request);
          retryRequest.headers.addAll(
            CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );

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
            if (kDebugMode) print('Retry response: ${newResponse.statusCode}, ${newResponse.body}');
            return newResponse;
          } finally {
            client.close();
          }
        } catch (e) {
          if (kDebugMode) print('Refresh failed: $e');
          if (e.toString().contains('Invalid refresh token') || e.toString().contains('401')) {
            await CookieManager.clearCookies(caller: 'CookieInterceptor.refresh');
          }
          return httpResponse; // Return original 401 response to trigger logout
        } finally {
          _isRetrying = false;
        }
      }

      return httpResponse;
    }
    return response;
  }

  http.Request _cloneRequest(http.BaseRequest original) {
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
  );

  static Future<http.Response> get(Uri url, {Map<String, String>? headers}) async {
    if (kDebugMode) print('CustomHttpClient GET $url');
    final mergedHeaders = CookieManager.getHeaders(headers);
    final response = await _client.get(url, headers: mergedHeaders);
    if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
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
    final response = await _client.post(
      url,
      headers: mergedHeaders,
      body: body,
      encoding: encoding,
    );
    if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
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
    final response = await _client.put(
      url,
      headers: mergedHeaders,
      body: body,
      encoding: encoding,
    );
    if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
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
    final response = await _client.delete(
      url,
      headers: mergedHeaders,
      body: body,
      encoding: encoding,
    );
    if (kDebugMode) print('Response: ${response.statusCode}, ${response.body}');
    return response;
  }
}