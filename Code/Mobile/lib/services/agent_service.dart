import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/agent.dart';
import '../models/user.dart';
import '../utils/constants.dart';
import '../services/cookie_manager.dart';

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
    if (kDebugMode) print('AgentService: Creating agent for $name $lastname');
    try {
      final headers = CookieManager.getHeaders();
      final body = json.encode({
        'name': name,
        'lastname': lastname,
        'email': email,
        'phone': phone,
        'supervisorID': supervisorID,
        'delegationID': delegationID,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        if (locationAddress != null) 'locationAddress': locationAddress,
      });

      final response = await http.post(
        Uri.parse('$baseUrl/agents'),
        headers: {...headers, 'Content-Type': 'application/json'},
        body: body,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 201) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 201) {
        final data = json.decode(response.body);
        final agent = Agent.fromJson(data);
        if (kDebugMode) print('Agent created: ${agent.agentID}');
        return agent;
      } else {
        final error = 'Failed to create agent: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error creating agent: $e');
      throw Exception('Error creating agent: $e');
    }
  }

  Future<List<Agent>> fetchAllAgents() async {
    if (kDebugMode) print('AgentService: Fetching all agents');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final agents = (data['agents'] as List).map((json) => Agent.fromJson(json)).toList();
        if (kDebugMode) print('Agents fetched: ${agents.length}');
        return agents;
      } else {
        final error = 'Failed to fetch all agents: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching all agents: $e');
      throw Exception('Error fetching all agents: $e');
    }
  }

  Future<Agent?> fetchAgentById(String id) async {
    if (kDebugMode) print('AgentService: Fetching agent by ID: $id');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents/$id'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final agent = Agent.fromJson(data);
        if (kDebugMode) print('Agent fetched: ${agent.agentID}');
        return agent;
      } else if (response.statusCode == 404) {
        if (kDebugMode) print('No agent found for ID: $id');
        return null;
      } else {
        final error = 'Failed to fetch agent: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agent by ID: $e');
      return null;
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
    if (kDebugMode) print('AgentService: Updating agent ID: $id');
    try {
      final headers = CookieManager.getHeaders();
      final body = json.encode({
        if (name != null) 'name': name,
        if (lastname != null) 'lastname': lastname,
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
        if (supervisorID != null) 'supervisorID': supervisorID,
        if (delegationID != null) 'delegationID': delegationID,
      });

      final response = await http.put(
        Uri.parse('$baseUrl/agents/$id'),
        headers: {...headers, 'Content-Type': 'application/json'},
        body: body,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final agent = Agent.fromJson(data);
        if (kDebugMode) print('Agent updated: ${agent.agentID}');
        return agent;
      } else {
        final error = 'Failed to update agent: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error updating agent: $e');
      throw Exception('Error updating agent: $e');
    }
  }

  Future<bool> deleteAgent(String id) async {
    if (kDebugMode) print('AgentService: Deleting agent ID: $id');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/agents/$id'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        if (kDebugMode) print('Agent deleted: $id');
        return true;
      } else {
        final error = 'Failed to delete agent: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error deleting agent: $e');
      throw Exception('Error deleting agent: $e');
    }
  }

  Future<Agent?> fetchAgentByPhone(String phone) async {
    if (kDebugMode) print('AgentService: Fetching agent by phone: $phone');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents/phone/$phone'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data != null) {
          final agent = Agent.fromJson(data);
          if (kDebugMode) print('Agent fetched: ${agent.agentID}');
          return agent;
        } else {
          if (kDebugMode) print('No agent found for phone: $phone');
          return null;
        }
      } else if (response.statusCode == 404) {
        if (kDebugMode) print('No agent found for phone: $phone');
        return null;
      } else {
        final error = 'Failed to fetch agent: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agent by phone: $e');
      return null;
    }
  }

  Future<List<Agent>> fetchAgentsByDelegation(String delegationID) async {
    if (kDebugMode) print('AgentService: Fetching agents for delegation: $delegationID');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents/delegation?delegationID=$delegationID'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final agents = (data['agents'] as List).map((json) => Agent.fromJson(json)).toList();
        if (kDebugMode) print('Agents fetched: ${agents.length}');
        return agents;
      } else {
        final error = 'Failed to fetch agents by delegation: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agents by delegation: $e');
      throw Exception('Error fetching agents by delegation: $e');
    }
  }

  Future<List<String>> fetchUniqueLocations() async {
    if (kDebugMode) print('AgentService: Fetching unique locations');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents/locations'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final locations = data.map((loc) => loc.toString()).toList();
        if (kDebugMode) print('Unique locations: $locations');
        return locations;
      } else {
        final error = 'Failed to fetch locations: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching unique locations: $e');
      throw Exception('Error fetching locations: $e');
    }
  }

  Future<User?> getAgentSupervisor(String agentID) async {
    if (kDebugMode) print('AgentService: Fetching supervisor by agent ID: $agentID');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents/$agentID/supervisor'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final supervisor = User.fromJson(data);
        if (kDebugMode) print('Supervisor fetched: ${supervisor.userID}');
        return supervisor;
      } else if (response.statusCode == 404) {
        if (kDebugMode) print('No supervisor found for agent: $agentID');
        return null;
      } else {
        final error = 'Failed to fetch supervisor: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching supervisor by agent: $e');
      return null;
    }
  }

  Future<List<Agent>> getAgentsByUser(String userID) async {
    if (kDebugMode) print('AgentService: Fetching agents by user ID: $userID');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents/user/$userID'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final agents = (data['agents'] as List).map((json) => Agent.fromJson(json)).toList();
        if (kDebugMode) print('Agents fetched: ${agents.length}');
        return agents;
      } else {
        final error = 'Failed to fetch agents: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agents by user: $e');
      throw Exception('Error fetching agents: $e');
    }
  }

  Future<Map<String, dynamic>> uploadAgents(Uint8List fileBytes) async {
    if (kDebugMode) print('AgentService: Uploading agent CSV');
    try {
      final headers = CookieManager.getHeaders();
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/agents/upload'),
      );
      request.headers.addAll(headers);
      request.files.add(
        http.MultipartFile.fromBytes(
          'file',
          fileBytes,
          filename: 'agents.csv',
        ),
      );

      final response = await request.send();
      final responseBody = await response.stream.bytesToString();

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: $responseBody');
      }

      if (response.statusCode == 200) {
        final data = json.decode(responseBody);
        if (kDebugMode) print('CSV processed: ${data['status']}');
        return data;
      } else {
        final error = 'Failed to upload agents: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error uploading agents: $e');
      throw Exception('Error uploading agents: $e');
    }
  }

  Future<List<Agent>> fetchAgentLocations() async {
    if (kDebugMode) print('AgentService: Fetching agent locations');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents/map/locations'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final agents = data.map((json) => Agent.fromJson(json)).toList();
        if (kDebugMode) print('Agent locations fetched: ${agents.length}');
        return agents;
      } else {
        final error = 'Failed to fetch agent locations: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agent locations: $e');
      throw Exception('Error fetching agent locations: $e');
    }
  }

  Future<List<Agent>> fetchNearbyAgents({
    required double lat,
    required double lng,
    double radius = 5000,
  }) async {
    if (kDebugMode) print('AgentService: Fetching nearby agents at ($lat, $lng)');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents/nearby?lat=$lat&lng=$lng&radius=$radius'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final agents = data.map((json) => Agent.fromJson(json)).toList();
        if (kDebugMode) print('Nearby agents fetched: ${agents.length}');
        return agents;
      } else {
        final error = 'Failed to fetch nearby agents: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching nearby agents: $e');
      throw Exception('Error fetching nearby agents: $e');
    }
  }

  Future<List<Agent>> fetchAgentsByBounds({
    required double southWestLat,
    required double southWestLng,
    required double northEastLat,
    required double northEastLng,
  }) async {
    if (kDebugMode) print('AgentService: Fetching agents by bounds');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents/bounds?southWestLat=$southWestLat&southWestLng=$southWestLng&northEastLat=$northEastLat&northEastLng=$northEastLng'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final agents = data.map((json) => Agent.fromJson(json)).toList();
        if (kDebugMode) print('Agents by bounds fetched: ${agents.length}');
        return agents;
      } else {
        final error = 'Failed to fetch agents by bounds: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agents by bounds: $e');
      throw Exception('Error fetching agents by bounds: $e');
    }
  }

  Future<bool> correctAgentLocation({
    required String agentId,
    required double latitude,
    required double longitude,
    required String address,
  }) async {
    if (kDebugMode) print('AgentService: Correcting location for agent ID: $agentId');
    try {
      final headers = CookieManager.getHeaders();
      final body = json.encode({
        'agentId': agentId,
        'latitude': latitude,
        'longitude': longitude,
        'address': address,
      });

      final response = await http.post(
        Uri.parse('$baseUrl/agents/correct-location'),
        headers: {...headers, 'Content-Type': 'application/json'},
        body: body,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        if (kDebugMode) print('Agent location corrected for ID: $agentId');
        return true;
      } else {
        final error = 'Failed to correct agent location: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error correcting agent location: $e');
      throw Exception('Error correcting agent location: $e');
    }
  }
}