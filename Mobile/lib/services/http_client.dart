import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_interceptor/http_interceptor.dart';
import 'auth_service.dart';
import 'cookie_manager.dart';

// Intercepts HTTP requests and responses to manage cookies and handle token refresh.
class CookieInterceptor implements InterceptorContract {
  bool _isRetrying = false;

  // Adds cookies and default headers to outgoing requests.
  @override
  Future<BaseRequest> interceptRequest({required BaseRequest request}) async {
    final headers = CookieManager.getHeaders({'Content-Type': 'application/json'});
    request.headers.addAll(headers);
    if (kDebugMode) print('Intercepting request: ${request.url}, headers: ${request.headers}');
    return request;
  }

  // Processes responses, extracts cookies, and retries on 401 errors.
  @override
  Future<BaseResponse> interceptResponse({required BaseResponse response}) async {
    http.Response httpResponse = await _normalizeResponse(response);

    CookieManager.extractCookies(httpResponse);

    // Handle 401 errors with token refresh
    if (httpResponse.statusCode == 401 && !_isRetrying) {
      _isRetrying = true;
      try {
        if (kDebugMode) print('401 detected, attempting token refresh');
        final refreshResult = await AuthService.refreshToken();
        if (kDebugMode) print('Token refresh result: $refreshResult');

        // Retry the original request
        final request = httpResponse.request!;
        final retryRequest = _cloneRequest(request);
        retryRequest.headers.addAll(CookieManager.getHeaders({'Content-Type': 'application/json'}));

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
          await CookieManager.clearCookies(caller: 'CookieInterceptor');
        }
        return httpResponse;
      } finally {
        _isRetrying = false;
      }
    }

    return httpResponse;
  }

  // Converts StreamedResponse to Response for consistent processing.
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

  // Clones an HTTP request for retrying.
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



// Custom HTTP client with cookie interception for authenticated requests.
class CustomHttpClient {
  static final InterceptedClient _client = InterceptedClient.build(
    interceptors: [CookieInterceptor()],
    client: http.Client(),
  );

  // Sends a GET request with merged headers.
  static Future<http.Response> get(Uri url, {Map<String, String>? headers}) async {
    if (kDebugMode) print('GET $url');
    final mergedHeaders = CookieManager.getHeaders(headers);
    final response = await _client.get(url, headers: mergedHeaders);
    if (kDebugMode) print('GET response: ${response.statusCode}');
    return response;
  }

  // Sends a POST request with merged headers and body.
  static Future<http.Response> post(
      Uri url, {
        Map<String, String>? headers,
        Object? body,
        Encoding? encoding,
      }) async {
    if (kDebugMode) print('POST $url');
    final mergedHeaders = CookieManager.getHeaders(headers);
    final response = await _client.post(
      url,
      headers: mergedHeaders,
      body: body,
      encoding: encoding,
    );
    if (kDebugMode) print('POST response: ${response.statusCode}');
    return response;
  }

  // Sends a PUT request with merged headers and body.
  static Future<http.Response> put(
      Uri url, {
        Map<String, String>? headers,
        Object? body,
        Encoding? encoding,
      }) async {
    if (kDebugMode) print('PUT $url');
    final mergedHeaders = CookieManager.getHeaders(headers);
    final response = await _client.put(
      url,
      headers: mergedHeaders,
      body: body,
      encoding: encoding,
    );
    if (kDebugMode) print('PUT response: ${response.statusCode}');
    return response;
  }

  // Sends a DELETE request with merged headers and body.
  static Future<http.Response> delete(
      Uri url, {
        Map<String, String>? headers,
        Object? body,
        Encoding? encoding,
      }) async {
    if (kDebugMode) print('DELETE $url');
    final mergedHeaders = CookieManager.getHeaders(headers);
    final response = await _client.delete(
      url,
      headers: mergedHeaders,
      body: body,
      encoding: encoding,
    );
    if (kDebugMode) print('DELETE response: ${response.statusCode}');
    return response;
  }
}