import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../models/agent.dart';
import '../models/user.dart';
import '../utils/constants.dart';
import './auth_service.dart';
import './cookie_manager.dart';

class AgentService {
  Future<Agent?> createAgent({
    required String name,
    required String lastname,
    required String email,
    required String phone,
    required String supervisorID,
    required String delegationID,
    double? latitude,
    double? longitude,
    String? locationAddress,
  }) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents');
          final response = await http.post(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({
              'name': name,
              'lastname': lastname,
              'email': email,
              'phone': phone,
              'supervisorID': supervisorID,
              'delegationID': delegationID,
              'latitude': latitude,
              'longitude': longitude,
              'locationAddress': locationAddress,
            }),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 201) return response;
          throw Exception('Failed to create agent: ${response.statusCode}');
        },
      );
      return Agent.fromJson(response['agent'] ?? response);
    } catch (e) {
      if (kDebugMode) print('Error creating agent: $e');
      rethrow;
    }
  }

  Future<List<Agent>> fetchAllAgents() async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch agents: ${response.statusCode}');
        },
      );
      return (response['agents'] ?? response as List).map((json) => Agent.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching all agents: $e');
      rethrow;
    }
  }

  Future<Agent?> fetchAgentById(String id) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents/$id');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch agent by ID: ${response.statusCode}');
        },
      );
      return Agent.fromJson(response['agent'] ?? response);
    } catch (e) {
      if (kDebugMode) print('Error fetching agent by ID: $e');
      rethrow;
    }
  }

  Future<Agent?> updateAgent({
    required String id,
    String? name,
    String? lastname,
    String? email,
    String? phone,
    String? supervisorID,
    String? delegationID,
  }) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents/$id');
          final response = await http.put(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({
              if (name != null) 'name': name,
              if (lastname != null) 'lastname': lastname,
              if (email != null) 'email': email,
              if (phone != null) 'phone': phone,
              if (supervisorID != null) 'supervisorID': supervisorID,
              if (delegationID != null) 'delegationID': delegationID,
            }),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to update agent: ${response.statusCode}');
        },
      );
      return Agent.fromJson(response['agent'] ?? response);
    } catch (e) {
      if (kDebugMode) print('Error updating agent: $e');
      rethrow;
    }
  }

  Future<bool> deleteAgent(String id) async {
    try {
      await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents/$id');
          final response = await http.delete(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to delete agent: ${response.statusCode}');
        },
      );
      return true;
    } catch (e) {
      if (kDebugMode) print('Error deleting agent: $e');
      rethrow;
    }
  }

  Future<Agent?> fetchAgentByPhone(String phone) async {
    try {
      Future<http.Response> makeRequest() async {
        final url = Uri.parse('$baseUrl/agents/phone/$phone');
        final response = await http.get(
          url,
          headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
        );
        CookieManager.extractCookies(response);
        if (kDebugMode) print('AgentService: Fetching agent by phone: $phone');
        return response;
      }

      var response = await makeRequest();
      if (response.statusCode == 401) {
        final refreshToken = CookieManager.cookies['refreshToken'];
        if (refreshToken == null || refreshToken.isEmpty) {
          await CookieManager.clearCookies();
          throw Exception('Session expired. Please log in again.');
        }
        try {
          final refreshResult = await AuthService.refreshToken(refreshToken);
          if (kDebugMode) print('Refresh result: $refreshResult');
          response = await makeRequest(); // Retry the request
        } catch (e) {
          await CookieManager.clearCookies();
          throw Exception('Session expired. Please log in again.');
        }
      }
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        if (kDebugMode) print('Agent fetched: ${decoded['agentID']}');
        return Agent.fromJson(decoded['agent'] ?? decoded);
      } else if (response.statusCode == 404) {
        return null; // Agent not found
      } else {
        throw Exception('Failed to fetch agent by phone: ${response.statusCode}');
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agent by phone: $e');
      rethrow;
    }
  }

  Future<List<Agent>> fetchAgentsByDelegation(String delegationID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents/delegation?delegationID=$delegationID');
          if (kDebugMode) print('Fetching agents for delegation with URL: $url');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          if (response.statusCode == 404) {
            throw Exception('No agents found for this delegation');
          }
          throw Exception('Failed to fetch agents by delegation: ${response.statusCode}');
        },
      );
      // Response is already a decoded JSON map from makeAuthenticatedRequest
      final agentList = (response['agents'] as List<dynamic>?) ?? [];
      return agentList.map((json) => Agent.fromJson(json as Map<String, dynamic>)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching agents by delegation: $e');
      return []; // Return an empty list instead of rethrowing
    }
  }


  Future<List<String>> fetchUniqueLocations() async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents/locations');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch unique locations: ${response.statusCode}');
        },
      );
      return List<String>.from(response['locations'] ?? response);
    } catch (e) {
      if (kDebugMode) print('Error fetching unique locations: $e');
      rethrow;
    }
  }

  Future<User?> getAgentSupervisor(String agentID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents/$agentID/supervisor');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch supervisor: ${response.statusCode}');
        },
      );
      return User.fromJson(response['supervisor'] ?? response);
    } catch (e) {
      if (kDebugMode) print('Error fetching supervisor: $e');
      rethrow;
    }
  }

  static Future<List<Agent>> getAgentsByUser(String userID) async {
    try {
      final decodedResponse = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents/user/$userID');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (kDebugMode) print('AgentService: Fetching agents by user ID: $userID');
          if (response.statusCode != 200) {
            throw Exception('Failed to fetch agents by user: ${response.statusCode}');
          }
          return response;
        },
      );
      // decodedResponse is the decoded JSON body from a successful request
      final agentList = decodedResponse['agents'] as List<dynamic>? ?? [];
      final agents = agentList.map((json) => Agent.fromJson(json as Map<String, dynamic>)).toList();
      if (kDebugMode) print('Agents fetched: ${agents.length}');
      return agents;
    } catch (e) {
      if (kDebugMode) print('Error fetching agents by user: $e');
      throw Exception('Failed to fetch agents by user: $e');
    }
  }

  Future<Map<String, dynamic>> uploadAgents(Uint8List fileBytes) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents/upload');
          final request = http.MultipartRequest('POST', url)
            ..headers.addAll(CookieManager.getHeaders({'Content-Type': 'multipart/form-data'}));
          request.files.add(http.MultipartFile.fromBytes(
            'file',
            fileBytes,
            filename: 'agents.csv',
            contentType: MediaType('text', 'csv'),
          ));
          final streamedResponse = await request.send();
          final responseBody = await streamedResponse.stream.bytesToString();
          final httpResponse = http.Response(responseBody, streamedResponse.statusCode, headers: streamedResponse.headers);
          CookieManager.extractCookies(httpResponse);
          if (httpResponse.statusCode == 200) return httpResponse;
          throw Exception('Failed to upload agents: $responseBody');
        },
      );
      return response;
    } catch (e) {
      if (kDebugMode) print('Error uploading agents: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> fetchAgentLocations() async {
    final url = Uri.parse('$baseUrl/agents/map/locations');
    print('Fetching agent locations from: $url');
    final response = await http.get(
      url,
      headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
    );
    print('Response status: ${response.statusCode}, body: ${response.body}');
    if (response.statusCode == 200) {
      return jsonDecode(response.body)['locations']; // Extract the 'locations' array
    }
    throw Exception('Failed to fetch agent locations: ${response.statusCode}');
  }

  Future<List<Agent>> fetchNearbyAgents({
    required double lat,
    required double lng,
    double radius = 5000,
  }) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents/nearby?lat=$lat&lng=$lng&radius=$radius');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch nearby agents: ${response.statusCode}');
        },
      );
      return (response['agents'] ?? response as List).map((json) => Agent.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching nearby agents: $e');
      rethrow;
    }
  }

  Future<List<Agent>> fetchAgentsByBounds({
    required double southWestLat,
    required double southWestLng,
    required double northEastLat,
    required double northEastLng,
  }) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse(
            '$baseUrl/agents/bounds?southWestLat=$southWestLat&southWestLng=$southWestLng&northEastLat=$northEastLat&northEastLng=$northEastLng',
          );
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch agents by bounds: ${response.statusCode}');
        },
      );
      return (response['agents'] ?? response as List).map((json) => Agent.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) print('Error fetching agents by bounds: $e');
      rethrow;
    }
  }

  Future<bool> correctAgentLocation({
    required String agentId,
    required double latitude,
    required double longitude,
    required String address,
  }) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/agents/$agentId/location');
          final response = await http.put(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({
              'latitude': latitude,
              'longitude': longitude,
              'address': address,
            }),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to correct agent location: ${response.statusCode}');
        },
      );
      return response['success'] ?? true;
    } catch (e) {
      if (kDebugMode) print('Error correcting agent location: $e');
      rethrow;
    }
  }
}